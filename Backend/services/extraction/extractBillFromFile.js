import { extractBillNumber, extractTotalAmount } from "../../parsers/index.js";
import { extractTextFromImage } from "../vision/visionText.service.js";
import { extractTextFromPDF } from "../pdf/pdfText.service.js";
import {
  checkOCRLimit,
  incrementOCRUsage,
} from "../ocr/ocrLimit.service.js";
import { isPaidOCRAllowed } from "../featureFlag.service.js";

export const extractBillsFromFile = async (filePath, mimeType) => {
  // 🔒 SINGLE OCR GATE
  const paidEnabled = await isPaidOCRAllowed();
  const quota = await checkOCRLimit(new Date(), paidEnabled);

  if (!quota.allowed) {
    const err = new Error(quota.message);
    err.statusCode = 429;
    throw err;
  }

  // Decide billing mode ONCE
  const mode = quota.mode;
  const price = quota.mode === "paid" ? quota.pricePerRequest : 0;

  let bills = [];

  /* ---------- PDF ---------- */
  if (mimeType === "application/pdf") {
    const result = await extractTextFromPDF(filePath);
    bills = result?.bills || [];
  } else {
    /* ---------- IMAGE ---------- */
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

  // ✅ Increment OCR usage ONCE PER FILE
  await incrementOCRUsage({
    mode,
    price,
  });

  return bills
    .map((b) => ({
      billNo: b.billNo?.trim().toLowerCase(),
      amount: typeof b.amount === "number" ? b.amount : null,
      page: b.page ?? 1,
      confidence: b.confidence ?? "medium",
    }))
    .filter((b) => b.billNo && b.amount);
};
