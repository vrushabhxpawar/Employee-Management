import asyncHandler from "../middlewares/asyncHandler.js";
import path from "path";
import { extractTextFromPDF } from "../services/pdf/pdfText.service.js";
import { extractTextFromImage } from "../services/vision/visionText.service.js";
import { extractBillNumber, extractTotalAmount } from "../parsers/index.js";
import { ensureFileExists } from "../utils/file.util.js";
import BillIndex from "../models/billIndex.model.js";
import { isOCRServiceEnabled } from "../services/featureFlag.service.js";
import { isPaidOCRAllowed } from "../services/featureFlag.service.js";

export const extractText = asyncHandler(async (req, res) => {
  /* ================= STEP 1: HARD OCR GATE ================= */
  if (!(await isOCRServiceEnabled())) {
    return res.status(503).json({
      success: false,
      message: "OCR service is currently disabled. Upload is blocked.",
    });
  }

  /* ================= STEP 2: INPUT VALIDATION ================= */
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

  /* ================= STEP 3: FILE RESOLUTION ================= */
  const fileName = path.basename(fileUrl);
  const filePath = path.join(process.cwd(), "uploads", fileName);
  ensureFileExists(filePath);

  /* ================= STEP 4: BILLING MODE ================= */
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

  /* ================= DUPLICATE HELPER ================= */
  const normalizeBill = (bill) => {
    return {
      billNo: bill.billNo?.toString().trim() || null,
      amount: bill.amount ? parseFloat(bill.amount) : null,
      page: bill.page || 1,
    };
  };

  const findDbDuplicates = async (bills) => {
    const normalizedBills = bills
      .map(normalizeBill)
      .filter((b) => b.billNo && b.amount);

    const billKeyToPdfBill = new Map();

    for (const bill of normalizedBills) {
      const key = `${bill.billNo}_${bill.amount}`;
      billKeyToPdfBill.set(key, bill);
    }

    const existingBills = await BillIndex.find({
      billKey: { $in: [...billKeyToPdfBill.keys()] },
    }).populate("sourceEmployee", "name email"); // optional but recommended

    return existingBills.map((dbBill) => {
      const pdfBill = billKeyToPdfBill.get(dbBill.billKey);

      return {
        billNo: pdfBill.billNo,
        amount: pdfBill.amount,
        page: pdfBill.page,

        // 👇 previous upload info
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

  /* ================= IMAGE FLOW ================= */
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

  /* ================= PDF FLOW ================= */
  if (fileType === "pdf") {
    const pdfResult = await extractTextFromPDF(filePath);

    if (!pdfResult?.bills?.length) {
      return res.status(400).json({
        success: false,
        message: "No text could be extracted from the PDF",
      });
    }

    const duplicates = await findDbDuplicates(pdfResult.bills);

    if (duplicates.length > 0) {
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_BILLS_IN_SYSTEM",
        duplicates,
      });
    }

    for (const bill of pdfResult.bills) {
      await BillIndex.create({
        billKey: `${bill.billNo}_${bill.amount}`,
        billNumber: bill.billNo,
        amount: bill.amount,
      });
    }

    return res.json({
      success: true,
      type: "pdf",
      billing: paidOCR ? "paid" : "free",
      totalBillsDetected: pdfResult.totalBillsDetected,
      bills: pdfResult.bills,
      remaining: paidOCR ? null : quota.remaining - 1,
    });
  }
});
