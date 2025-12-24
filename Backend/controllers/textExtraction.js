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
        .map(page => page.content.map(item => item.str).join(" "))
        .join("\n");
    } 
    else if (fileType === "image") {
      const result = await Tesseract.recognize(filePath, "eng");
      extractedText = result.data.text;
    } 
    else {
      return res.status(400).json({
        success: false,
        message: "Unsupported file type",
      });
    }

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
    console.error("Extraction error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* ================= FIELD EXTRACTION ================= */
function extractSpecificFields(text, fields) {
  const result = {};

  const patterns = {
    bill_number: [
      /\bNumber\s*[:\-]?\s*(\d+)\b/gi
    ],
    total_amount: [
      /\bCash\s+([0-9]+(?:\.[0-9]{2})?)\b/gi
    ],
  };

  for (const field of fields) {
    const key = field.toLowerCase().replace(/\s+/g, "_");
    let value = null;

    if (patterns[key]) {
      for (const regex of patterns[key]) {
        const matches = [...text.matchAll(regex)];
        if (matches.length) {
          value = matches[0][1]; // first clean match
          break;
        }
      }
    }

    result[field] = value;
  }

  return result;
}
