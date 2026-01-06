export const isValidBillNumber = (billNo) => {
  // 🔴 SAFETY CHECK
  if (billNo === null || billNo === undefined) return false;

  // Convert everything to string safely
  const cleaned = String(billNo).trim().toUpperCase();

  // Reject empty or very short values
  if (cleaned.length < 2) return false;

  // Reject common OCR junk
  const blacklist = ["NO", "IS", "RECEIPT", "BILL", "TOTAL"];
  if (blacklist.includes(cleaned)) return false;

  // Must contain at least one digit
  if (!/\d/.test(cleaned)) return false;

  return true;
};
