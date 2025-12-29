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
      // Enhanced Tesseract with better preprocessing
      const result = await Tesseract.recognize(filePath, "eng", {
        logger: (m) => console.log(m),
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        tessedit_char_whitelist:
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz£$₹€¥.,:-/#() ",
      });
      extractedText = result.data.text;
    } else {
      return res.status(400).json({
        success: false,
        message: "Unsupported file type",
      });
    }

    console.log("📄 Raw Extracted Text:", extractedText);

    if (!extractedText.trim()) {
      return res.status(200).json({
        success: true,
        text: "",
        extractedData: {},
        message: "No text detected",
      });
    }

    const response = {
      success: true,
      text: extractedText.trim(),
    };

    // Always extract bill number and total amount
    if (Array.isArray(extractFields) && extractFields.length > 0) {
      response.extractedData = extractSpecificFields(
        extractedText,
        extractFields
      );
      console.log("✅ Final Extracted Data:", response.extractedData);
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
/* ================= ENHANCED FIELD EXTRACTION FOR REAL BILLS ================= */
function extractSpecificFields(text, fields) {
  const result = {};
  
  // Normalize text but keep line breaks for context
  const normalizedText = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  
  const lines = normalizedText.split("\n").map(line => line.trim());

  console.log("🔍 Processing", lines.length, "lines");
  console.log("📄 First 10 lines:", lines.slice(0, 10));

  const patterns = {
    /* ==================== ENHANCED BILL NUMBER PATTERNS ==================== */
    bill_number: [
      // Receipt-No variations (with dash, space, colon)
      /Receipt[\s\-]*No\.?[\s:]*([A-Z0-9]+)/gi,
      
      // Number: 8 (standalone format common in restaurant bills)
      /^Number[\s:]*([0-9A-Z]+)$/gim,
      
      // Transaction ID
      /Transaction[\s\-]*ID[\s:]*([A-Z0-9]+)/gi,
      
      // Bill No / Invoice No
      /(?:Bill|Invoice|Receipt|Order)[\s#\-]*(?:No\.?|Number|NUM)?[\s:]*([A-Z0-9\-\/]+)/gi,
      
      // GST numbers (often used as bill identifier in India)
      /GST[\s:]*([A-Z0-9]{15})/gi,
      
      // Standalone alphanumeric on receipt
      /^([A-Z][0-9]{2,}[A-Z0-9]*)$/gm,
      
      // Hash symbol format
      /#[\s]*([A-Z0-9\-\/]{3,})/g,
      
      // Order/Token number
      /(?:Order|Token|Table)[\s#\-]*(?:No\.?)?[\s:]*([0-9A-Z]+)/gi,
    ],

    /* ==================== ENHANCED AMOUNT PATTERNS ==================== */
    total_amount: [
      // "Amount:" followed by currency and number
      /Amount[\s:]*[£$₹€¥]?[\s]*([0-9]+[.,][0-9]{2})/gi,
      
      // "Cash" line (common in receipts) - usually the total
      /^Cash[\s:]*([0-9]+[.,][0-9]{2})$/gim,
      
      // "Total amount paid in cash"
      /Total\s+amount\s+paid[\s\w]*[£$₹€¥]?[\s]*([0-9]+[.,][0-9]{2})/gi,
      
      // Total variations with strong keywords
      /(?:Grand\s+Total|Net\s+Total|Final\s+Total|Total\s+Amount)[\s:]*[£$₹€¥]?[\s]*([0-9]+[.,][0-9]{2})/gi,
      
      // Just "Total" at start of line
      /^Total[\s:]*[£$₹€¥]?[\s]*([0-9]+[.,][0-9]{2})$/gim,
      
      // Balance/Amount Due
      /(?:Balance|Amount\s+Due|Due\s+Amount|Payable)[\s:]*[£$₹€¥]?[\s]*([0-9]+[.,][0-9]{2})/gi,
      
      // SST Summary pattern (common in Indian bills)
      /Amount[\s]*([0-9]+[.,][0-9]{2})/gi,
      
      // Currency symbol followed by amount (strict format)
      /[£$₹€¥][\s]*([0-9]+[.,][0-9]{2})\b/g,
      
      // Amount at end of line after equals or dash
      /[=\-–—][\s]*[£$₹€¥]?[\s]*([0-9]+[.,][0-9]{2})\s*$/gm,
      
      // Line with only currency and amount
      /^[£$₹€¥]?[\s]*([0-9]+[.,][0-9]{2})\s*$/gm,
    ],
  };

  for (const field of fields) {
    const key = field.toLowerCase().replace(/[\s_]+/g, "_");
    let value = null;

    console.log(`\n🔎 Extracting: ${field}`);

    if (patterns[key]) {
      const foundValues = [];
      
      for (const regex of patterns[key]) {
        regex.lastIndex = 0;
        const matches = [...normalizedText.matchAll(regex)];

        if (matches.length > 0) {
          console.log(`  ✓ Pattern matched (${matches.length} times):`, 
            matches.map(m => m[0].substring(0, 60)).slice(0, 3));
          
          matches.forEach(match => {
            const extracted = (match[1] || match[2] || "").trim();
            if (extracted && extracted.length > 0) {
              // Get context (surrounding text)
              const matchIndex = normalizedText.indexOf(match[0]);
              const contextStart = Math.max(0, matchIndex - 30);
              const contextEnd = Math.min(normalizedText.length, matchIndex + match[0].length + 30);
              const context = normalizedText.substring(contextStart, contextEnd);
              
              foundValues.push({
                value: extracted,
                context: context.replace(/\n/g, " "),
                fullMatch: match[0],
                pattern: regex.source.substring(0, 40)
              });
            }
          });
        }
      }

      // Smart selection logic
      if (foundValues.length > 0) {
        console.log(`  📊 Found ${foundValues.length} candidates`);
        
        if (key === "total_amount") {
          value = selectBestAmount(foundValues, normalizedText, lines);
        } else if (key === "bill_number") {
          value = selectBestBillNumber(foundValues, lines);
        } else {
          value = foundValues[0].value;
        }
      }
    }

    // Cleanup
    if (value) {
      if (key === "total_amount") {
        value = cleanAmount(value);
      } else if (key === "bill_number") {
        value = cleanBillNumber(value);
      }
    }

    console.log(`  ✅ Final Result: ${value || "NOT FOUND"}`);
    result[key] = value;
  }

  return result;
}

/* ================= IMPROVED: SELECT BEST AMOUNT ================= */
function selectBestAmount(foundValues, fullText, lines) {
  // Clean all amounts
  const amounts = foundValues.map(item => {
    const cleaned = item.value.replace(/[^\d.]/g, "");
    return {
      ...item,
      numeric: parseFloat(cleaned),
      cleaned: cleaned
    };
  }).filter(item => !isNaN(item.numeric) && item.numeric > 0);

  if (amounts.length === 0) return null;

  console.log("  💰 Amount candidates:", amounts.map(a => 
    `${a.numeric.toFixed(2)} (context: "${a.context.substring(0, 40)}...")`
  ));

  // Priority scoring system
  const scored = amounts.map(item => {
    let score = 0;
    const contextLower = item.context.toLowerCase();
    const fullMatchLower = item.fullMatch.toLowerCase();
    
    // HIGHEST PRIORITY: Explicit payment/total keywords
    if (/total\s+amount\s+paid/i.test(contextLower)) {
      score += 200;
      console.log(`    +200: "total amount paid"`);
    }
    
    if (/^cash[\s:]*[0-9]/i.test(fullMatchLower)) {
      score += 180;
      console.log(`    +180: Cash line (standalone)`);
    }
    
    if (/grand\s+total|net\s+total|final\s+total/i.test(contextLower)) {
      score += 150;
      console.log(`    +150: Grand/Net/Final Total`);
    }
    
    if (/amount[\s:]*[£$₹€¥]?\s*[0-9]/i.test(fullMatchLower) && fullMatchLower.length < 20) {
      score += 120;
      console.log(`    +120: Simple "Amount:" format`);
    }
    
    if (/^total[\s:]/i.test(fullMatchLower)) {
      score += 100;
      console.log(`    +100: Starts with "Total"`);
    }
    
    if (/balance|amount\s+due|payable/i.test(contextLower)) {
      score += 80;
      console.log(`    +80: Balance/Due/Payable`);
    }
    
    // Position scoring: prefer amounts in the bottom 30% of document
    const position = fullText.indexOf(item.fullMatch);
    const relativePos = position / fullText.length;
    if (relativePos > 0.7) {
      score += 50;
      console.log(`    +50: Near end of document (${(relativePos * 100).toFixed(0)}%)`);
    }
    
    // Size preference: larger amounts often = total (but not always)
    if (item.numeric > 50) {
      score += Math.min(30, item.numeric / 10);
      console.log(`    +${Math.min(30, Math.floor(item.numeric / 10))}: Larger amount`);
    }
    
    // Penalty for amounts in middle of itemized list
    if (/qty|price|rate|item/i.test(contextLower)) {
      score -= 50;
      console.log(`    -50: Looks like line item`);
    }
    
    // Check if this is the largest amount (often the total)
    const isLargest = item.numeric === Math.max(...amounts.map(a => a.numeric));
    if (isLargest && amounts.length > 2) {
      score += 40;
      console.log(`    +40: Largest amount found`);
    }
    
    return { ...item, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  console.log("  🏆 Top 3 candidates:");
  scored.slice(0, 3).forEach((s, i) => {
    console.log(`    ${i + 1}. ${s.numeric.toFixed(2)} (score: ${s.score.toFixed(1)}) - ${s.fullMatch}`);
  });
  
  return scored[0].cleaned;
}

/* ================= IMPROVED: SELECT BEST BILL NUMBER ================= */
function selectBestBillNumber(foundValues, lines) {
  console.log("  🔢 Bill number candidates:", foundValues.map(v => v.value));
  
  // Score bill numbers
  const scored = foundValues.map(item => {
    let score = 0;
    const contextLower = item.context.toLowerCase();
    const fullMatchLower = item.fullMatch.toLowerCase();
    
    // HIGHEST PRIORITY: Explicit receipt/bill number
    if (/receipt[\s\-]*no/i.test(fullMatchLower)) {
      score += 200;
      console.log(`    +200: "Receipt No."`);
    }
    
    if (/^number[\s:]/i.test(fullMatchLower)) {
      score += 180;
      console.log(`    +180: Starts with "Number:"`);
    }
    
    if (/transaction[\s\-]*id/i.test(fullMatchLower)) {
      score += 150;
      console.log(`    +150: Transaction ID`);
    }
    
    if (/bill|invoice|receipt|order/i.test(contextLower)) {
      score += 120;
      console.log(`    +120: Bill/Invoice context`);
    }
    
    // Length scoring: prefer longer, more unique numbers
    if (item.value.length >= 8) {
      score += 80;
      console.log(`    +80: Long number (${item.value.length} chars)`);
    } else if (item.value.length >= 5) {
      score += 50;
      console.log(`    +50: Medium length`);
    } else if (item.value.length <= 3) {
      score -= 40;
      console.log(`    -40: Too short (${item.value.length} chars)`);
    }
    
    // Alphanumeric is usually better than just numbers
    const hasLetters = /[A-Z]/i.test(item.value);
    const hasNumbers = /[0-9]/.test(item.value);
    
    if (hasLetters && hasNumbers) {
      score += 60;
      console.log(`    +60: Alphanumeric`);
    } else if (hasNumbers && item.value.length > 6) {
      score += 30;
      console.log(`    +30: Numeric but long`);
    }
    
    // Position: prefer numbers in top 20% of document
    const lineIndex = lines.findIndex(line => line.includes(item.fullMatch));
    if (lineIndex >= 0 && lineIndex < lines.length * 0.2) {
      score += 40;
      console.log(`    +40: Near top of document (line ${lineIndex})`);
    }
    
    // Penalty for numbers that look like phone numbers, dates, etc.
    if (/^[0-9]{10}$/.test(item.value)) {
      score -= 60;
      console.log(`    -60: Looks like phone number`);
    }
    
    if (/^[0-9]{1,2}[\/-][0-9]{1,2}/.test(item.value)) {
      score -= 50;
      console.log(`    -50: Looks like date`);
    }
    
    return { ...item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  
  console.log("  🏆 Top 3 candidates:");
  scored.slice(0, 3).forEach((s, i) => {
    console.log(`    ${i + 1}. "${s.value}" (score: ${s.score})`);
  });
  
  return scored[0].value;
}

/* ================= HELPER: CLEAN AMOUNT ================= */
function cleanAmount(value) {
  // Remove everything except digits and decimal point
  let cleaned = value.replace(/[^\d.,]/g, "");
  
  // Handle European format (comma as decimal separator)
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes(',') && cleaned.includes('.')) {
    // Determine which is decimal separator (last one)
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Comma is decimal separator
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Dot is decimal separator
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  
  const numeric = parseFloat(cleaned);
  
  if (isNaN(numeric) || numeric <= 0) return null;
  
  // Format to 2 decimal places
  return numeric.toFixed(2);
}

/* ================= HELPER: CLEAN BILL NUMBER ================= */
function cleanBillNumber(value) {
  // Remove common OCR errors and extra characters
  return value
    .trim()
    .replace(/['"`,;()]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

/* ================= HELPER: SELECT BEST AMOUNT ================= */
function selectBestAmount(foundValues, fullText) {
  // Clean all amounts
  const amounts = foundValues.map(item => ({
    ...item,
    numeric: parseFloat(item.value.replace(/[^\d.]/g, ""))
  })).filter(item => !isNaN(item.numeric) && item.numeric > 0);

  if (amounts.length === 0) return null;

  // Priority scoring
  const scored = amounts.map(item => {
    let score = 0;
    const contextLower = item.context.toLowerCase();
    
    // High priority keywords
    if (/grand total|net total|final total|amount due|balance due/i.test(contextLower)) {
      score += 100;
    } else if (/total amount|amount payable|total\s*:/i.test(contextLower)) {
      score += 50;
    } else if (/^total/i.test(contextLower)) {
      score += 30;
    }
    
    // Prefer larger amounts (likely the final total)
    score += item.numeric / 100;
    
    // Prefer amounts at the end of the document
    const position = fullText.indexOf(item.context);
    const relativePos = position / fullText.length;
    score += relativePos * 20;
    
    return { ...item, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  console.log("  💰 Amount candidates:", scored.slice(0, 3).map(s => 
    `${s.numeric.toFixed(2)} (score: ${s.score.toFixed(1)})`
  ));
  
  return scored[0].value;
}

/* ================= HELPER: SELECT BEST BILL NUMBER ================= */
function selectBestBillNumber(foundValues) {
  // Score bill numbers
  const scored = foundValues.map(item => {
    let score = 0;
    const contextLower = item.context.toLowerCase();
    
    // Prefer explicit bill/invoice keywords
    if (/invoice|bill|receipt/i.test(contextLower)) {
      score += 50;
    } else if (/transaction|reference/i.test(contextLower)) {
      score += 30;
    }
    
    // Prefer longer numbers (more likely to be unique)
    score += item.value.length * 2;
    
    // Prefer alphanumeric over just numbers
    if (/[A-Z]/i.test(item.value) && /[0-9]/.test(item.value)) {
      score += 20;
    }
    
    // Penalty for very short numbers
    if (item.value.length < 4) {
      score -= 30;
    }
    
    return { ...item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  
  console.log("  🔢 Bill number candidates:", scored.slice(0, 3).map(s => 
    `${s.value} (score: ${s.score})`
  ));
  
  return scored[0].value;
}

/* ================= HELPER: CLEAN AMOUNT ================= */
function cleanAmount(value) {
  // Remove everything except digits and decimal point
  const cleaned = value.replace(/[^\d.]/g, "");
  const numeric = parseFloat(cleaned);
  
  if (isNaN(numeric)) return null;
  
  // Format to 2 decimal places
  return numeric.toFixed(2);
}

/* ================= HELPER: CLEAN BILL NUMBER ================= */
function cleanBillNumber(value) {
  // Remove common OCR errors and extra characters
  return value
    .trim()
    .replace(/['"`,;]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
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

    // Extract all amounts with context
    const amountRegex = /([^\n]*?)([£$₹€¥]\s*[0-9]+[.,][0-9]{2})([^\n]*)/g;
    const amounts = [];
    let match;

    while ((match = amountRegex.exec(extractedText)) !== null) {
      const context = (match[1] + match[3]).trim();
      const amount = match[2].replace(/[^\d.]/g, "");
      amounts.push({
        value: parseFloat(amount),
        context: context.substring(0, 50),
        formatted: match[2]
      });
    }

    // Sort by value descending
    amounts.sort((a, b) => b.value - a.value);

    res.status(200).json({
      success: true,
      allAmounts: amounts,
      likelyTotal: amounts[0]?.value || null,
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