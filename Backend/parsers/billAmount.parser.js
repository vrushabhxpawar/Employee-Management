export const extractTotalAmount = (text) => {
  if (!text) return null;

  console.log("Searching for total amount in OCR text...");

  // Normalize text - remove extra spaces
  const normalizedText = text.replace(/\s+/g, ' ');

  const patterns = [
    /Total\s*[:\.]?\s*([\d,\s]+(?:\.\d{2})?)/i,
    /TOTAL\s*[:\.]?\s*([\d,\s]+(?:\.\d{2})?)/i,
    /Grand\s*Total\s*[:\.]?\s*([\d,\s]+(?:\.\d{2})?)/i,
    /Net\s*Total\s*[:\.]?\s*([\d,\s]+(?:\.\d{2})?)/i,
    /(?:Rs\.?|₹)\s*([\d,\s]+(?:\.\d{2})?)/i,
  ];

  let amounts = [];

  for (const pattern of patterns) {
    const matches = [...normalizedText.matchAll(new RegExp(pattern, 'gi'))];
    for (const match of matches) {
      // Remove commas and spaces from the number
      const cleanNumber = match[1].replace(/[,\s]/g, "");
      const value = parseFloat(cleanNumber);
      if (!isNaN(value) && value > 0) {
        console.log("Found amount:", value);
        amounts.push(value);
      }
    }
  }

  if (amounts.length) {
    const maxAmount = Math.max(...amounts);
    console.log("✓ Selected total amount:", maxAmount);
    return maxAmount;
  }

  console.log("✗ No amount found");
  return null;
};