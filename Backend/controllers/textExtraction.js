import asyncHandler from "../middlewares/asyncHandler.js";
import path from "path";
import { extractTextFromPDF } from "../services/pdf/pdfText.service.js";
import { extractTextFromImage } from "../services/vision/visionText.service.js";
import { extractBillNumber, extractTotalAmount } from "../parsers/index.js";
import { ensureFileExists } from "../utils/file.util.js";
import BillIndex from "../models/billIndex.model.js";
import {
  isOCRServiceEnabled,
  isPaidOCRAllowed,
} from "../services/featureFlag.service.js";
import { incrementOCRUsage } from "../services/ocr/ocrLimit.service.js";
import { checkOCRLimit } from "../services/ocr/ocrLimit.service.js";

/* ================= DUPLICATE HELPERS ================= */

const normalizeBill = (bill) => ({
  billNo: bill.billNo?.toString().trim() || null,
  amount: bill.amount ? parseFloat(bill.amount) : null,
  page: bill.page || 1,
});

const findDbDuplicates = async (bills) => {
  const normalized = bills
    .map(normalizeBill)
    .filter((b) => b.billNo && b.amount);

  if (!normalized.length) return [];

  const billKeyMap = new Map();
  normalized.forEach((b) => billKeyMap.set(`${b.billNo}_${b.amount}`, b));

  const existing = await BillIndex.find({
    billKey: { $in: [...billKeyMap.keys()] },
  }).populate("sourceEmployee", "name email");

  return existing.map((dbBill) => {
    const pdfBill = billKeyMap.get(dbBill.billKey);
    return {
      billNo: pdfBill.billNo,
      amount: pdfBill.amount,
      page: pdfBill.page,
      uploadedBy: dbBill.sourceEmployee
        ? {
            id: dbBill.sourceEmployee._id,
            name: dbBill.sourceEmployee.name,
            email: dbBill.sourceEmployee.email,
          }
        : null,
      uploadedAt: dbBill.createdAt,
    };
  });
};

export const getPdfStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const job = await BillIndex.findById(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Job not found",
    });
  }

  return res.json({
    success: true,
    status: job.status,
    error: job.error || null,
  });
});


/* ================= BACKGROUND PDF PROCESSOR ================= */

const processPdfInBackground = async (filePath, jobId) => {
  try {
    const pdfResult = await extractTextFromPDF(filePath);

    if (!pdfResult?.bills?.length) {
      await BillIndex.findByIdAndUpdate(jobId, {
        status: "failed",
        error: "No bills detected",
      });
      return;
    }

    await BillIndex.insertMany(
      pdfResult.bills.map((bill) => ({
        billKey: `${bill.billNo}_${bill.amount}`,
        billNumber: bill.billNo,
        amount: bill.amount,
        sourceFile: path.basename(filePath),
        status: "completed",
      })),
      { ordered: false }
    );

    await BillIndex.findByIdAndUpdate(jobId, {
      status: "completed",
    });
  } catch (err) {
    await BillIndex.findByIdAndUpdate(jobId, {
      status: "failed",
      error: err.message,
    });
  }
};

/* ================= CONTROLLER ================= */

export const extractText = asyncHandler(async (req, res) => {
  /* ===== OCR SERVICE GATE ===== */
  if (!(await isOCRServiceEnabled())) {
    return res.status(503).json({
      success: false,
      message: "OCR service is currently disabled.",
    });
  }

  /* ===== INPUT VALIDATION ===== */
  const { fileUrl, fileType } = req.body;

  if (!fileUrl || !fileType) {
    return res.status(400).json({
      success: false,
      message: "fileUrl and fileType are required",
    });
  }

  if (!["image", "pdf"].includes(fileType)) {
    return res.status(400).json({
      success: false,
      message: "Invalid file type. Supported types: image, pdf",
    });
  }

  /* ===== FILE RESOLUTION ===== */
  const fileName = path.basename(fileUrl);
  const filePath = path.join(process.cwd(), "uploads", fileName);
  ensureFileExists(filePath);

  /* ===== BILLING CHECK ===== */
  const paidOCR = await isPaidOCRAllowed();
  let quota = null;

  if (!paidOCR) {
    quota = await checkOCRLimit();
    if (!quota.allowed) {
      return res.status(429).json({
        success: false,
        exhausted: true,
        pricePerRequest: quota.pricePerRequest,
        resetAt: quota.resetAt,
        message: quota.message,
      });
    }
  }

  /* ================= IMAGE FLOW (SYNC) ================= */
  if (fileType === "image") {
    const text = await extractTextFromImage(filePath);

    if (!text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "No text could be extracted from the image",
      });
    }

    const bill = {
      billNo: extractBillNumber(text),
      amount: extractTotalAmount(text),
      page: 1,
    };

    const duplicates = await findDbDuplicates([bill]);
    if (duplicates.length > 0) {
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_BILLS_IN_SYSTEM",
        duplicates,
      });
    }

    await BillIndex.create({
      billKey: `${bill.billNo}_${bill.amount}`,
      billNumber: bill.billNo,
      amount: bill.amount,
    });

    if (!paidOCR) await incrementOCRUsage();

    return res.json({
      success: true,
      type: "image",
      billing: paidOCR ? "paid" : "free",
      extractedData: bill,
      remaining: paidOCR ? null : quota.remaining - 1,
    });
  }

  /* ================= PDF FLOW (ASYNC) ================= */
  if (fileType === "pdf") {
    const job = await BillIndex.create({
      status: "processing",
      sourceFile: fileName,
    });

    processPdfInBackground(filePath, job._id);

    return res.status(202).json({
      success: true,
      type: "pdf",
      jobId: job._id,
      message: "PDF uploaded. Processing started.",
      billing: paidOCR ? "paid" : "free",
      remaining: paidOCR ? null : quota.remaining - 1,
    });
  }
});
