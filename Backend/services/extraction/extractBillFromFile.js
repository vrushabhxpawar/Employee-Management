import { extractBillNumber, extractTotalAmount } from "../../parsers/index.js";
import { extractTextFromImage } from "../vision/visionText.service.js";
import { extractTextFromPDF } from "../pdf/pdfText.service.js";

/**
 * ✅ OPTIMIZED: Extract bills from file (image or PDF)
 * NOTE: Quota checking and incrementing should be done at the CONTROLLER level,
 * not here, because we need to know total pages before checking quota.
 */
export const extractBillsFromFile = async (filePath, mimeType) => {
  let bills = [];

  /* ---------- PDF ---------- */
  if (mimeType === "application/pdf") {
    const result = await extractTextFromPDF(filePath);
    bills = result?.bills || [];
  } 
  /* ---------- IMAGE ---------- */
  else if (mimeType.startsWith("image/")) {
    const text = await extractTextFromImage(filePath);
    bills = [
      {
        billNo: extractBillNumber(text),
        amount: extractTotalAmount(text),
        page: 1,
        confidence: "high",
      },
    ];
  } 
  else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  // Normalize and filter bills
  return bills
    .map((b) => ({
      billNo: b.billNo?.trim().toLowerCase(),
      amount: typeof b.amount === "number" ? b.amount : null,
      page: b.page ?? 1,
      confidence: b.confidence ?? "medium",
    }))
    .filter((b) => b.billNo && b.amount);
};

/**
 * ✅ NEW: Get page count without processing (for quota pre-check)
 * Useful for checking if user has enough quota before processing
 */
export const getFilePageCount = async (filePath, mimeType) => {
  if (mimeType === "application/pdf") {
    // Use a lightweight method to count PDF pages
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execPromise = promisify(exec);
    
    try {
      const { stdout } = await execPromise(`pdfinfo "${filePath}" | grep Pages | awk '{print $2}'`);
      return parseInt(stdout.trim()) || 1;
    } catch (error) {
      console.error("Failed to get page count:", error);
      return 1; // Default to 1 page if check fails
    }
  }
  
  // Images are always 1 page
  return 1;
};