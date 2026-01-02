import { extractBillNumber, extractTotalAmount } from "../../parsers/index.js";
import { extractTextFromImage } from "../vision/visionText.service.js";
import { extractTextFromPDF } from "../pdf/pdfText.service.js";

/* ================= NORMALIZER ================= */

const normalizeBill = (bill, page = 1) => {
  const billNo =
    typeof bill.billNo === "string"
      ? bill.billNo.trim().toLowerCase()
      : null;

  const amount =
    typeof bill.amount === "number"
      ? Number(bill.amount)
      : null;

  return {
    billNo,
    amount,
    page,
    confidence: bill.confidence || "medium",
  };
};

/* ================= MAIN ================= */

export const extractBillsFromFile = async (filePath, mimeType) => {
  /* ---------- PDF ---------- */
  if (mimeType === "application/pdf") {
    const result = await extractTextFromPDF(filePath);

    if (!result?.bills?.length) return [];

    return result.bills
      .map((bill) => normalizeBill(bill, bill.page))
      .filter((b) => b.billNo && b.amount);
  }

  /* ---------- IMAGE ---------- */
  const text = await extractTextFromImage(filePath);

  const billNo = extractBillNumber(text);
  const amount = extractTotalAmount(text);

  const normalized = normalizeBill(
    {
      billNo,
      amount,
      confidence: "high",
    },
    1
  );

  return normalized.billNo && normalized.amount ? [normalized] : [];
};
