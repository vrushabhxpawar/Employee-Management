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
import { incrementOCRUsage, checkOCRLimit } from "../services/ocr/ocrLimit.service.js";

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
    data: job.extractedBills || null,
  });
});

/* ================= BACKGROUND PDF PROCESSOR ================= */

const processPdfInBackground = async (filePath, jobId, paidOCR) => {
  try {
    console.log(`🔄 Starting background PDF processing for job ${jobId}`);
    
    // Step 1: Extract text from PDF (optimized with batch OCR)
    const pdfResult = await extractTextFromPDF(filePath);

    if (!pdfResult?.bills?.length) {
      await BillIndex.findByIdAndUpdate(jobId, {
        status: "failed",
        error: "No bills detected in PDF",
      });
      console.log(`❌ Job ${jobId} failed: No bills detected`);
      return;
    }

    console.log(`📄 Extracted ${pdfResult.bills.length} bills from PDF`);

    // Step 2: Check for duplicates
    const duplicates = await findDbDuplicates(pdfResult.bills);

    if (duplicates.length > 0) {
      await BillIndex.findByIdAndUpdate(jobId, {
        status: "failed",
        error: "duplicate_bills_detected",
        duplicates: duplicates,
        extractedBills: pdfResult.bills,
      });
      console.log(`⚠️ Job ${jobId} failed: ${duplicates.length} duplicates found`);
      return;
    }

    // Step 3: Save all bills to database
    const billsToInsert = pdfResult.bills
      .filter(bill => bill.billNo && bill.amount)
      .map((bill) => ({
        billKey: `${bill.billNo}_${bill.amount}`,
        billNumber: bill.billNo,
        amount: bill.amount,
        page: bill.page,
        confidence: bill.confidence,
        sourceFile: path.basename(filePath),
      }));

    if (billsToInsert.length > 0) {
      await BillIndex.insertMany(billsToInsert, { ordered: false });
    }

    // Step 4: Update job status
    await BillIndex.findByIdAndUpdate(jobId, {
      status: "completed",
      extractedBills: pdfResult.bills,
      totalBillsDetected: pdfResult.totalBillsDetected,
      completedAt: new Date(),
    });

    // Step 5: Increment OCR usage (ONCE for all pages)
    const totalPages = pdfResult.bills.length;
    if (!paidOCR) {
      await incrementOCRUsage({ mode: "free", count: totalPages });
    } else {
      await incrementOCRUsage({ mode: "paid", price: 0.1, count: totalPages });
    }

    console.log(`✅ Job ${jobId} completed successfully. ${totalPages} pages processed.`);
  } catch (err) {
    console.error(`❌ Job ${jobId} failed:`, err);
    await BillIndex.findByIdAndUpdate(jobId, {
      status: "failed",
      error: err.message,
      failedAt: new Date(),
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
        resetAt: quota.resetAt,
        message: quota.message,
        remaining: 0,
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

    // Increment OCR usage for 1 image
    if (!paidOCR) {
      await incrementOCRUsage({ mode: "free", count: 1 });
    } else {
      await incrementOCRUsage({ mode: "paid", price: 0.1, count: 1 });
    }

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
    // Create job record
    const job = await BillIndex.create({
      status: "processing",
      sourceFile: fileName,
      startedAt: new Date(),
    });

    // Start background processing (non-blocking)
    processPdfInBackground(filePath, job._id, paidOCR).catch(err => {
      console.error(`Background job ${job._id} error:`, err);
    });

    return res.status(202).json({
      success: true,
      type: "pdf",
      jobId: job._id,
      message: "PDF uploaded. Processing started in background.",
      billing: paidOCR ? "paid" : "free",
      statusUrl: `/api/pdf-status/${job._id}`,
    });
  }
});