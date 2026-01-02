import asyncHandler from "../middlewares/asyncHandler.js";
import path from "path";
import { extractTextFromPDF } from "../services/pdf/pdfText.service.js";
import { extractTextFromImage } from "../services/vision/visionText.service.js";
import { extractBillNumber, extractTotalAmount } from "../parsers/index.js";
import { ensureFileExists } from "../utils/file.util.js";
import BillIndex from "../models/billIndex.model.js";

export const extractText = asyncHandler(async (req, res) => {
  const { fileUrl, fileType } = req.body;

  const fileName = path.basename(fileUrl);
  const filePath = path.join(process.cwd(), "uploads", fileName);

  ensureFileExists(filePath);

  /* ================= IMAGE FLOW ================= */
  if (fileType === "image") {
    const text = await extractTextFromImage(filePath);

    // Add validation for OCR result
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

    // Changed: Return data even if partially extracted (more lenient)
    return res.json({
      success: true,
      type: "image",
      extractedData,
      rawText: text,
      warning:
        !extractedData.bill_number || !extractedData.total_amount
          ? "Some fields could not be extracted"
          : null,
    });
  }

  /* ================= PDF FLOW ================= */
  if (fileType === "pdf") {
    const pdfResult = await extractTextFromPDF(filePath);

    // Add validation for PDF result
    if (!pdfResult || !pdfResult.bills) {
      return res.status(400).json({
        success: false,
        message: "No text could be extracted from the PDF",
      });
    }

    return res.json({
      success: true,
      type: "pdf",
      totalBillsDetected: pdfResult.totalBillsDetected,
      bills: pdfResult.bills,
    });
  }

  return res.status(400).json({
    success: false,
    message: "Invalid file type. Supported types: image, pdf",
  });
});
