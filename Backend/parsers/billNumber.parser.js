export const extractBillNumber = (text) => {
  if (!text) return null;

  console.log("Searching for bill number in OCR text...");
  console.log("Text preview:", text.substring(0, 200));

  // Remove extra spaces and normalize
  const normalizedText = text.replace(/\s+/g, ' ');

  const patterns = [
    /Bill\s*No\.?\s*[:\.]?\s*(\d+)/i,
    /BILL\s*NO\.?\s*[:\.]?\s*(\d+)/i,
    /B\s*I\s*L\s*L\s*N\s*O\.?\s*[:\.]?\s*(\d+)/i, // Handles "B I L L N O . 152"
    /Invoice\s*(?:No\.?|#)?\s*[:\.]?\s*(\d+)/i,
    /No\.?\s*[:\.]?\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      console.log("✓ Found bill number:", match[1]);
      return match[1].trim();
    }
  }

  console.log("✗ No bill number found");
  return null;
};