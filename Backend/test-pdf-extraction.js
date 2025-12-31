import asyncHandler from "./middlewares/asyncHandler.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vision from "@google-cloud/vision";
import PDFParser from "pdf2json";

/* ================= SETUP ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Google Vision client
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, "..", "keys", "google-vision.json"),
});

/* ================= PDF EXTRACTION ================= */

const extractTextFromPDF = (filePath) => {
  return new Promise((resolve, reject) => {
    console.log("📄 Reading PDF file from:", filePath);
    
    const pdfParser = new PDFParser();
    
    pdfParser.on("pdfParser_dataError", (errData) => {
      console.error("❌ PDF parsing error:", errData.parserError);
      reject(new Error(`PDF extraction failed: ${errData.parserError}`));
    });
    
    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      try {
        console.log("✅ PDF parsed successfully");
        
        // Extract text from all pages
        let fullText = "";
        let numPages = 0;
        
        if (pdfData.Pages) {
          numPages = pdfData.Pages.length;
          console.log(`📚 PDF has ${numPages} page(s)`);
          
          pdfData.Pages.forEach((page, pageIndex) => {
            if (page.Texts) {
              page.Texts.forEach((text) => {
                if (text.R) {
                  text.R.forEach((r) => {
                    if (r.T) {
                      // Decode URI component
                      const decodedText = decodeURIComponent(r.T);
                      fullText += decodedText + " ";
                    }
                  });
                }
              });
              fullText += "\n"; // Add newline after each page
            }
            console.log(`✅ Extracted text from page ${pageIndex + 1}`);
          });
        }
        
        fullText = fullText.trim();
        console.log(`✅ Total extracted: ${fullText.length} characters`);
        
        resolve({
          fullText,
          numPages,
          metadata: pdfData.Meta || {}
        });
      } catch (error) {
        console.error("❌ Error processing PDF data:", error);
        reject(error);
      }
    });
    
    // Load PDF file
    pdfParser.loadPDF(filePath);
  });
};

/* ================= NORMALIZE ================= */

const normalizeText = (text) => {
  if (!text) return "";
  
  return text
    .replace(/\r/g, "")
    .replace(/\f/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .trim();
};

/* ================= ENHANCED PARSERS ================= */

const extractBillNumber = (text) => {
  if (!text) return null;
  
  console.log("\n🔍 Searching for bill number...");
  
  const patterns = [
    /(?:Bill|Invoice|Receipt|Challan|Voucher)[\s\-_#:]*(?:No\.?|Number|Num|ID)[\s\-_#:]*([A-Z0-9\-\/]{3,})/i,
    /(?:Bill|Invoice|Receipt)[\s\-_]*#[\s\-_]*([A-Z0-9\-\/]{3,})/i,
    /(?:Ref|Reference)[\s\-_:]*(?:No\.?)?[\s\-_:]*([A-Z0-9\-\/]{3,})/i,
    /Tax[\s]+Invoice[\s\-_:]*(?:No\.?)?[\s\-_:]*([A-Z0-9\-\/]{3,})/i,
    /(?:Serial|SR|Doc|Document)[\s\-_:]*(?:No\.?)?[\s\-_:]*([A-Z0-9\-\/]{3,})/i,
    /\b(INV[-\/]?\d+|REC[-\/]?\d+|BIL[-\/]?\d+|BILL[-\/]?\d+)\b/i,
    /\b([A-Z]{2,4}[-\/]?\d{4,})\b/,
    /(?:Bill|Invoice|Receipt)[\s]*:[\s]*([A-Z0-9\-\/]{3,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const billNum = match[1].trim();
      
      if (billNum.length >= 3 && 
          billNum.length <= 25 &&
          !billNum.match(/^(GST|GSTIN|PAN|TIN|TAX|PIN|ZIP)$/i) &&
          !billNum.match(/^\d{10}$/) &&
          !billNum.match(/^\d{15}$/) &&
          !billNum.match(/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/)) {
        
        console.log(`✅ Found bill number: ${billNum}`);
        return billNum;
      }
    }
  }
  
  console.log("⚠️ No bill number found");
  return null;
};

const extractTotalAmount = (text) => {
  if (!text) return null;
  
  console.log("\n💰 Searching for total amount...");
  
  const patterns = [
    /(?:Grand[\s]+)?Total[\s]*(?:Amount)?[\s]*:?[\s]*(?:Rs\.?|INR|₹)?[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /Net[\s]+(?:Amount|Total|Payable)[\s]*:?[\s]*(?:Rs\.?|INR|₹)?[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /(?:Amount[\s]+)?(?:Payable|Due)[\s]*:?[\s]*(?:Rs\.?|INR|₹)?[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /(?:Cash|Card|Paid|Payment)[\s]*(?:Amount)?[\s]*:?[\s]*(?:Rs\.?|INR|₹)?[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /Balance[\s]*:?[\s]*(?:Rs\.?|INR|₹)?[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /(?:Final|Bill)[\s]+Amount[\s]*:?[\s]*(?:Rs\.?|INR|₹)?[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /(?:Rs\.?|INR|₹)[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
    /Total[\s]*:[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
  ];

  let amounts = [];

  for (const pattern of patterns) {
    const matches = [...text.matchAll(new RegExp(pattern, 'gi'))];
    
    for (const match of matches) {
      if (match[1]) {
        const amountStr = match[1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        
        if (!isNaN(amount) && amount > 0 && amount < 10000000) {
          amounts.push(amount);
          console.log(`   Found amount: ₹${amount} (${match[0].trim()})`);
        }
      }
    }
  }

  if (amounts.length === 0) {
    console.log("⚠️ No amounts found");
    return null;
  }

  const maxAmount = Math.max(...amounts);
  console.log(`✅ Selected total amount: ₹${maxAmount}`);
  
  return maxAmount;
};

const extractShopDetails = (text) => {
  if (!text) return { shopName: null, address: null, phone: null, gstin: null };
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  return {
    shopName: lines[0] || null,
    address: lines.slice(1, 3).join(", ") || null,
    phone: text.match(/(?:Ph|Phone|Tel|Mobile)[\s:]*(\d{10})/i)?.[1] || 
           text.match(/\b(\d{10})\b/)?.[1] || null,
    gstin: text.match(/(?:GSTIN?|GST[\s]*No)[\s:]*([0-9A-Z]{15})/i)?.[1] || null
  };
};

const extractItems = (text) => {
  if (!text) return [];
  
  const items = [];
  const lines = text.split('\n');

  const patterns = [
    /^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d{2}))\s+(\d+(?:\.\d{2}))$/,
    /^(.+?)\s*[|]\s*(\d+(?:\.\d+)?)\s*[|]\s*(\d+(?:\.\d{2}))\s*[|]\s*(\d+(?:\.\d{2}))$/,
    /^(.+?)\s+(\d+)\s*x\s*(\d+(?:\.\d{2}))\s*=\s*(\d+(?:\.\d{2}))$/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const itemName = match[1].trim();
        
        if (!itemName.match(/^(Item|Product|Description|Name|S\.?No|Particulars)/i) &&
            itemName.length > 1) {
          items.push({
            name: itemName,
            quantity: parseFloat(match[2]),
            price: parseFloat(match[3]),
            amount: parseFloat(match[4])
          });
        }
        break;
      }
    }
  }

  return items;
};

/* ================= MULTI-PAGE PDF HANDLER ================= */

const extractFromMultiPagePDF = async (filePath) => {
  console.log("\n📚 Processing multi-page PDF...");
  
  const { fullText, numPages } = await extractTextFromPDF(filePath);
  
  // Try to split by page breaks or common separators
  let pageTexts = fullText.split(/\n\n+/);
  
  if (pageTexts.length === 1) {
    const splitPatterns = [
      /(?=INVOICE|BILL|RECEIPT|TAX INVOICE)/i,
      /\n-{20,}\n/,
      /\n={20,}\n/,
    ];
    
    for (const pattern of splitPatterns) {
      const split = fullText.split(pattern);
      if (split.length > 1) {
        pageTexts = split;
        break;
      }
    }
  }
  
  console.log(`📑 Split into ${pageTexts.length} sections`);
  
  const bills = [];
  
  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i];
    
    if (!pageText || pageText.trim().length < 20) {
      console.log(`⏭️ Skipping section ${i + 1} - insufficient content`);
      continue;
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing Section ${i + 1}/${pageTexts.length}`);
    console.log('='.repeat(60));
    
    const billNumber = extractBillNumber(pageText);
    const totalAmount = extractTotalAmount(pageText);
    
    if (billNumber || totalAmount) {
      bills.push({
        page: i + 1,
        bill_number: billNumber,
        total_amount: totalAmount ? totalAmount.toFixed(2) : null,
        raw_text: pageText,
        shop: extractShopDetails(pageText),
        items: extractItems(pageText)
      });
      
      console.log(`✅ Extracted from section ${i + 1}:`, {
        bill_number: billNumber,
        total_amount: totalAmount
      });
    } else {
      console.log(`⚠️ No bill data found in section ${i + 1}`);
    }
  }
  
  return bills;
};

/* ================= MAIN CONTROLLER ================= */

export const extractText = asyncHandler(async (req, res) => {
  const { fileUrl, fileType, extractFields, multiPage = false } = req.body;

  console.log("\n" + "=".repeat(80));
  console.log("📥 NEW EXTRACTION REQUEST");
  console.log("=".repeat(80));
  console.log("Request:", { fileUrl, fileType, extractFields, multiPage });

  if (!fileUrl || !fileType) {
    return res.status(400).json({
      success: false,
      message: "fileUrl and fileType are required"
    });
  }

  const fileName = path.basename(fileUrl);
  const filePath = path.join(__dirname, "..", "uploads", fileName);

  console.log("📂 File path:", filePath);

  if (!fs.existsSync(filePath)) {
    console.log("❌ File not found!");
    return res.status(404).json({
      success: false,
      message: "File not found: " + fileName
    });
  }

  const fileStats = fs.statSync(filePath);
  console.log("✅ File found, size:", fileStats.size, "bytes");

  try {
    /* ===== MULTI-PAGE PDF ===== */
    if (fileType === "pdf" && multiPage) {
      const bills = await extractFromMultiPagePDF(filePath);
      
      console.log(`\n✅ Multi-page extraction: ${bills.length} bills found`);
      
      return res.json({
        success: true,
        multiPage: true,
        totalBills: bills.length,
        bills: bills.map(bill => ({
          page: bill.page,
          bill_number: bill.bill_number,
          total_amount: bill.total_amount,
          shop: bill.shop,
          items: bill.items
        })),
        metadata: {
          method: "pdf2json-multipage",
          fileName,
          pages: bills.length
        }
      });
    }

    /* ===== SINGLE PAGE PDF ===== */
    let rawText = "";
    
    if (fileType === "pdf") {
      console.log("\n📄 Extracting from PDF...");
      const { fullText } = await extractTextFromPDF(filePath);
      rawText = fullText;
    }

    /* ===== IMAGE (Google Cloud Vision) ===== */
    else if (fileType === "image") {
      console.log("\n🖼️ Extracting from image...");
      
      const [result] = await visionClient.textDetection(filePath);
      const detections = result.textAnnotations;

      if (detections && detections.length > 0) {
        rawText = detections[0].description;
        console.log("✅ Vision API: extracted", rawText.length, "characters");
      } else {
        console.log("⚠️ No text detected in image");
        rawText = "";
      }
    }

    else {
      return res.status(400).json({
        success: false,
        message: "Unsupported file type. Use 'pdf' or 'image'"
      });
    }

    console.log("\n" + "=".repeat(80));
    console.log("📄 RAW TEXT (length:", rawText.length, ")");
    console.log("=".repeat(80));
    console.log(rawText.substring(0, 500));
    if (rawText.length > 500) console.log("...(truncated)");
    console.log("=".repeat(80));

    if (!rawText || !rawText.trim()) {
      console.log("⚠️ No text extracted");
      return res.json({
        success: true,
        text: "",
        extractedData: { bill_number: null, total_amount: null },
        message: "No text extracted from file"
      });
    }

    const text = normalizeText(rawText);

    const billNumber = extractBillNumber(text);
    const totalAmount = extractTotalAmount(text);
    const shop = extractShopDetails(text);
    const items = extractItems(text);

    console.log("\n" + "=".repeat(80));
    console.log("📊 RESULTS");
    console.log("=".repeat(80));
    console.log("Bill Number:", billNumber || "❌ Not found");
    console.log("Total Amount:", totalAmount ? `₹${totalAmount}` : "❌ Not found");
    console.log("Items:", items.length);
    console.log("=".repeat(80) + "\n");

    // Return specific fields or full data
    if (extractFields && Array.isArray(extractFields)) {
      const extractedData = {};
      
      if (extractFields.includes("bill_number")) {
        extractedData.bill_number = billNumber;
      }
      if (extractFields.includes("total_amount")) {
        extractedData.total_amount = totalAmount ? totalAmount.toFixed(2) : null;
      }

      return res.json({
        success: true,
        text: rawText,
        extractedData,
        metadata: {
          method: fileType === "pdf" ? "pdf2json" : "google-vision",
          textLength: rawText.length,
          fileName
        }
      });
    }

    // Full structured data
    return res.json({
      success: true,
      text: rawText,
      data: {
        documentName: fileName,
        shop,
        bill_number: billNumber,
        items,
        paymentMode: "Cash",
        total_amount: totalAmount ? totalAmount.toFixed(2) : null,
        currency: totalAmount ? "INR" : null
      }
    });

  } catch (error) {
    console.error("\n❌ ERROR");
    console.error("=".repeat(80));
    console.error(error);
    console.error("=".repeat(80));
    
    return res.status(500).json({
      success: false,
      message: "Error extracting text: " + error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});