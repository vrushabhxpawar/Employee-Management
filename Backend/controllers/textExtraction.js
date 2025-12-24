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
  const { fileUrl, fileType } = req.body;

  if (!fileUrl || !fileType) {
    return res.status(400).json({
      success: false,
      message: "File URL and type are required",
    });
  }

  try {
    const filename = fileUrl.split("/").pop();
    const filePath = path.join(__dirname, "..", "uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    let extractedText = "";

    if (fileType === "pdf") {
      const data = await pdfExtract.extract(filePath, {});
      extractedText = data.pages
        .map((page) => page.content.map((item) => item.str).join(" "))
        .join("\n");
    } else if (fileType === "image") {
      const result = await Tesseract.recognize(filePath, "eng", {
        logger: (m) => console.log(m),
      });
      extractedText = result.data.text;
    } else {
      return res.status(400).json({
        success: false,
        message: "Unsupported file type",
      });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(200).json({
        success: true,
        text: "No text could be extracted from this file.",
      });
    }

    res.status(200).json({
      success: true,
      text: extractedText.trim(),
    });
  } catch (error) {
    console.error("Error extracting text:", error);
    res.status(500).json({
      success: false,
      message: "Error extracting text: " + error.message,
    });
  }
});