import asyncHandler from "../middlewares/asyncHandler.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { PDFExtract } from "pdf.js-extract";
import Tesseract from "tesseract.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pdfExtract = new PDFExtract();

/* ================= EXTRACT TEXT FROM FILE ================= */
export const extractText = asyncHandler(async (req, res) => {
  const { fileUrl, fileType, extractFields } = req.body;

  if (!fileUrl || !fileType) {
    return res.status(400).json({
      success: false,
      message: "File URL and type are required",
    });
  }

  const filename = fileUrl.split("/").pop();
  const filePath = path.join(__dirname, "..", "uploads", filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: "File not found",
    });
  }

  let extractedText = "";

  try {
    if (fileType === "pdf") {
      const data = await pdfExtract.extract(filePath, {});
      extractedText = data.pages
        .map((page) => page.content.map((item) => item.str).join(" "))
        .join("\n");
    } else if (fileType === "image") {
      // Enhanced Tesseract configuration for better accuracy
      const result = await Tesseract.recognize(filePath, "eng", {
        logger: (m) => console.log(m), // Optional: log progress
        tessedit_char_whitelist:
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz£$₹€.,:-/ ",
      });
      extractedText = result.data.text;
    } else {
      return res.status(400).json({
        success: false,
        message: "Unsupported file type",
      });
    }

    // Log extracted text for debugging
    console.log("📄 Extracted Text:", extractedText);

    if (!extractedText.trim()) {
      return res.status(200).json({
        success: true,
        text: "",
        message: "No text detected",
      });
    }

    const response = {
      success: true,
      text: extractedText.trim(),
    };

    if (Array.isArray(extractFields) && extractFields.length > 0) {
      response.extractedData = extractSpecificFields(
        extractedText,
        extractFields
      );
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Extraction error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* ================= ENHANCED FIELD EXTRACTION ================= */
function extractSpecificFields(text, fields) {
  const result = {};

  // Normalize text: remove extra spaces and newlines
  const normalizedText = text.replace(/\s+/g, " ").trim();

  console.log("🔍 Normalized Text:", normalizedText);

  const patterns = {
    // Merchant/Store name patterns
    total_amount: [
      // 1. Dash/hyphen followed by amount (— 25.00, - 25.00)
      /[—\-–]\s*([0-9]+(?:[.,][0-9]{2})?)/g,

      // 2. "Amount" keyword with optional currency
      /(?:Amount|Amt)[\s:]*[£$₹€]?\s*([0-9]+(?:[.,][0-9]{2})?)/gi,

      // 3. "Total" variations with OCR error tolerance
      /[Tt]o?t[ao]?l?[\s:]*(?:amount|amt)?[\s:]*[£$₹€]?\s*([0-9]+(?:[.,][0-9]{2})?)/gi,

      // 4. "Grand Total" variations
      /(?:Grand|Net|Final)[\s]*[Tt]otal[\s:]*[£$₹€]?\s*([0-9]+(?:[.,][0-9]{2})?)/gi,

      // 5. "Amount Due/Payable/Paid"
      /Amount[\s]*(?:Due|Payable|Paid|Owing)[\s:]*[£$₹€]?\s*([0-9]+(?:[.,][0-9]{2})?)/gi,

      // 6. "Balance" variations
      /(?:Balance|Bal)[\s]*(?:Due|Payable)?[\s:]*[£$₹€]?\s*([0-9]+(?:[.,][0-9]{2})?)/gi,

      // 7. Currency symbol followed by amount
      /[£$₹€]\s*([0-9]+(?:[.,][0-9]{2})?)/g,

      // 8. "Total amount paid" with OCR tolerance (Toto smount, Total amont)
      /[Tt][o0][t+][ao0]?[\s]*[sa][m]+[o0u][un][n+][t+][\s]*(?:paid|poss|pass)?[\s:]*[£$₹€]?\s*([0-9]+(?:[.,][0-9]{2})?)/gi,

      // 9. Amount at end of line after colon
      /:\s*[£$₹€]?\s*([0-9]+(?:[.,][0-9]{2})?)\s*$/gm,

      // 10. Standalone decimal amount (last resort)
      /\b([0-9]{1,6}[.,][0-9]{2})\b/g,

      // 11. "Sum" variations
      /(?:Sum|Total Sum)[\s:]*[£$₹€]?\s*([0-9]+(?:[.,][0-9]{2})?)/gi,

      // 12. "Charge" variations
      /(?:Total Charge|Charges)[\s:]*[£$₹€]?\s*([0-9]+(?:[.,][0-9]{2})?)/gi,
    ],

    /* ==================== BILL/INVOICE NUMBER PATTERNS ==================== */
    bill_number: [
      // 1. Standard bill number formats
      /(?:Bill|Invoice|Receipt)[\s]*(?:No\.?|Number|#)[\s:]*([A-Z0-9\-\/]+)/gi,

      // 2. Bill ID variations
      /(?:Bill|Invoice)[\s]*(?:ID|Id)[\s:]*([A-Z0-9\-\/]+)/gi,

      // 3. Just "No." or "Number" followed by alphanumeric
      /(?:^|\n)(?:No\.?|Number)[\s:]*([A-Z0-9\-\/]+)/gim,

      // 4. Reference number variations
      /(?:Ref|Reference)[\s]*(?:No\.?|Number)?[\s:]*([A-Z0-9\-\/]+)/gi,

      // 5. Document number
      /(?:Doc|Document)[\s]*(?:No\.?|Number)?[\s:]*([A-Z0-9\-\/]+)/gi,

      // 6. Invoice with OCR tolerance (lnvoice, Inv0ice)
      /[Il][nm][vw][o0][il][c][e][\s]*(?:No\.?|Number|#)?[\s:]*([A-Z0-9\-\/]+)/gi,

      // 7. Bill with hash symbol
      /#\s*([A-Z0-9\-\/]{3,})/g,

      // 8. Transaction number (often used as bill number)
      /(?:Transaction|Trans|Txn)[\s]*(?:No\.?|Number|ID)?[\s:]*([A-Z0-9\-\/]+)/gi,

      // 9. Order number
      /(?:Order|Ord)[\s]*(?:No\.?|Number|ID)?[\s:]*([A-Z0-9\-\/]+)/gi,

      // 10. Receipt variations with OCR tolerance
      /[Rr][e3][c][e3][il][p][t+][\s]*(?:No\.?|Number)?[\s:]*([A-Z0-9\-\/]+)/gi,

      // 11. Voucher number
      /(?:Voucher|Vchr)[\s]*(?:No\.?|Number)?[\s:]*([A-Z0-9\-\/]+)/gi,

      // 12. Serial number
      /(?:Serial|Sr|S\.No)[\s]*(?:No\.?|Number)?[\s:]*([A-Z0-9\-\/]+)/gi,
    ],
  };

  for (const field of fields) {
    const key = field.toLowerCase().replace(/[\s_]+/g, "_");
    let value = null;

    console.log(`🔎 Searching for field: ${field} (key: ${key})`);

    if (patterns[key]) {
      for (const regex of patterns[key]) {
        // Reset regex lastIndex to ensure fresh matching
        regex.lastIndex = 0;

        const matches = [...normalizedText.matchAll(regex)];

        if (matches.length > 0) {
          console.log(`✅ Found match for ${field}:`, matches);

          // For total_amount, try to get the last occurrence (usually the final total)
          if (key === "total_amount") {
            const lastMatch = matches[matches.length - 1];
            value = lastMatch[1] || lastMatch[2];

            // Clean the value
            value = value?.replace(/[^\d.]/g, "").trim();

            // Validate it's a proper number
            if (value && !isNaN(parseFloat(value))) {
              value = parseFloat(value).toFixed(2);
            }
          } else {
            // For other fields, take the first match
            value = matches[0][1] || matches[0][2];
          }

          break;
        }
      }
    } else {
      // If no pattern exists, try generic text search
      const searchTerm = field.replace(/_/g, " ");
      const genericRegex = new RegExp(
        `${searchTerm}\\s*[:\\-]?\\s*([^\\n]+)`,
        "gi"
      );
      const match = genericRegex.exec(normalizedText);
      if (match) {
        value = match[1]?.trim();
      }
    }

    console.log(`📌 ${field}: ${value || "Not found"}`);
    result[field] = value || null;
  }

  return result;
}

/* ================= HELPER: CLEAN EXTRACTED DATA ================= */
function cleanExtractedData(data) {
  const cleaned = {};

  for (const [key, value] of Object.entries(data)) {
    if (value) {
      // Clean up common OCR errors
      let cleanValue = value
        .trim()
        .replace(/\s+/g, " ") // Multiple spaces to single
        .replace(/['']/g, "'") // Smart quotes to regular
        .replace(/[""]/g, '"'); // Smart quotes to regular

      // For amounts, ensure proper formatting
      if (key.includes("amount") || key.includes("total")) {
        cleanValue = cleanValue.replace(/[^\d.]/g, "");
        if (!isNaN(parseFloat(cleanValue))) {
          cleanValue = parseFloat(cleanValue).toFixed(2);
        }
      }

      cleaned[key] = cleanValue;
    } else {
      cleaned[key] = null;
    }
  }

  return cleaned;
}

/* ================= ALTERNATIVE: EXTRACT ALL AMOUNTS ================= */
export const extractAllAmounts = asyncHandler(async (req, res) => {
  const { fileUrl, fileType } = req.body;

  if (!fileUrl || !fileType) {
    return res.status(400).json({
      success: false,
      message: "File URL and type are required",
    });
  }

  const filename = fileUrl.split("/").pop();
  const filePath = path.join(__dirname, "..", "uploads", filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: "File not found",
    });
  }

  try {
    let extractedText = "";

    if (fileType === "pdf") {
      const data = await pdfExtract.extract(filePath, {});
      extractedText = data.pages
        .map((page) => page.content.map((item) => item.str).join(" "))
        .join("\n");
    } else if (fileType === "image") {
      const result = await Tesseract.recognize(filePath, "eng");
      extractedText = result.data.text;
    }

    // Extract all amounts found in the text
    const amountRegex = /[£$₹€]\s*([0-9]+(?:\.[0-9]{2})?)/g;
    const amounts = [];
    let match;

    while ((match = amountRegex.exec(extractedText)) !== null) {
      amounts.push(parseFloat(match[1]));
    }

    // Get the largest amount (usually the total)
    const totalAmount = amounts.length > 0 ? Math.max(...amounts) : null;

    res.status(200).json({
      success: true,
      allAmounts: amounts,
      likelyTotal: totalAmount,
      text: extractedText.trim(),
    });
  } catch (error) {
    console.error("❌ Extraction error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
