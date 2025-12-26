import asyncHandler from "../middlewares/asyncHandler.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

/* ================= SETUP ================= */

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= NORMALIZE ================= */

const normalizeText = (text) =>
  text
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .trim();

/* ================= PARSERS ================= */

const extractShopDetails = (lines) => ({
  shopName: lines[0] || null,
  address: lines.slice(1, 3).join(", ") || null,
  phone: lines.find(l => l.includes("PH"))?.match(/\d{10}/)?.[0] || null,
  gstin: lines.find(l => l.includes("GST"))?.match(/[0-9A-Z]{15}/)?.[0] || null
});

const extractReceiptNumber = (lines) => {
  const line = lines.find(l => l.startsWith("Number"));
  return line ? line.split(":")[1]?.trim() : null;
};

const extractItems = (lines) => {
  const items = [];

  for (const line of lines) {
    const match = line.match(
      /^([A-Z\s()0-9]+)\s+(\d+\.\d{2})\s+(\d+\.\d{2})\s+(\d+\.\d{2})$/
    );

    if (match) {
      items.push({
        name: match[1].trim(),
        quantity: Number(match[2]),
        price: Number(match[3]),
        amount: Number(match[4])
      });
    }
  }

  return items;
};

const extractTotal = (lines) => {
  const cashLine = lines.find(l => l.startsWith("Cash"));
  if (!cashLine) return null;

  const match = cashLine.match(/(\d+\.\d{2})$/);
  return match ? Number(match[1]) : null;
};

/* ================= CONTROLLER ================= */

export const extractText = asyncHandler(async (req, res) => {
  const { fileUrl, fileType } = req.body;

  if (!fileUrl || !fileType) {
    return res.status(400).json({
      success: false,
      message: "fileUrl and fileType are required"
    });
  }

  const fileName = path.basename(fileUrl);
  const filePath = path.join(__dirname, "..", "uploads", fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: "File not found"
    });
  }

  let rawText = "";

  /* ===== PDF ===== */
  if (fileType === "pdf") {
    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(buffer);
    rawText = pdfData.text;
  }

  /* ===== IMAGE (placeholder for Cloud OCR) ===== */
  else if (fileType === "image") {
    return res.status(400).json({
      success: false,
      message: "Image OCR not wired yet (use Cloud OCR)"
    });
  }

  else {
    return res.status(400).json({
      success: false,
      message: "Unsupported file type"
    });
  }

  if (!rawText || !rawText.trim()) {
    return res.json({
      success: true,
      data: null,
      message: "No text extracted"
    });
  }

  const text = normalizeText(rawText);
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const shop = extractShopDetails(lines);
  const receiptNumber = extractReceiptNumber(lines);
  const items = extractItems(lines);
  const totalAmount = extractTotal(lines);

  res.json({
    success: true,
    data: {
      documentName: fileName,
      shop,
      receiptNumber,
      items,
      paymentMode: "Cash",
      totalAmount,
      currency: "INR"
    }
  });
});
