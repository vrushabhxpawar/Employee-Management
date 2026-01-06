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
  const ocrEnabled = await isOCRServiceEnabled();
  if (!ocrEnabled) {
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

  /* ================= STEP 4: PAID OCR CHECK ================= */
  const paidOCR = await isPaidOCRAllowed();
  console.log("🔎 PAID OCR FLAG =", paidOCR)
  /* ================= STEP 5: FREE LIMIT CHECK (ONLY IF NOT PAID) ================= */
  let quota = null;

  if (paidOCR !== true) {
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

  /* ================= IMAGE FLOW ================= */
  if (fileType === "image") {
    const text = await extractTextFromImage(filePath);

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "No text could be extracted from the image",
      });
    }

    const extractedData = {
      bill_number: extractBillNumber(text),
      total_amount: extractTotalAmount(text),
    };

    /* ===== DUPLICATE CHECK (ONLY AFTER OCR SUCCESS) ===== */
    if (extractedData.bill_number && extractedData.total_amount) {
      const billKey = `${extractedData.bill_number.trim()}_${
        extractedData.total_amount
      }`;
      const exists = await BillIndex.findOne({ billKey });

      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Duplicate bill detected",
        });
      }

      await BillIndex.create({
        billKey,
        billNumber: extractedData.bill_number.trim(),
        amount: extractedData.total_amount,
      });
    }

    /* ================= STEP 6: INCREMENT FREE USAGE ================= */
    if (paidOCR !== true) {
      await incrementOCRUsage();
    }

    return res.json({
      success: true,
      type: "image",
      billing: paidOCR ? "paid" : "free",
      extractedData,
      rawText: text,
      remaining: paidOCR ? null : quota.remaining - 1,
    });
  }

  /* ================= PDF FLOW ================= */
  if (fileType === "pdf") {
    const pdfResult = await extractTextFromPDF(filePath);

    if (!pdfResult || !pdfResult.bills) {
      return res.status(400).json({
        success: false,
        message: "No text could be extracted from the PDF",
      });
    }

    if (!paidOCR) {
      await incrementOCRUsage();
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
