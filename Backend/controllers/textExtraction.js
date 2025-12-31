import asyncHandler from "../middlewares/asyncHandler.js";
import path from "path";
import { extractTextFromPDF } from "../services/pdf/pdfText.service.js";
import { extractTextFromImage } from "../services/vision/visionText.service.js";
import { extractBillNumber, extractTotalAmount } from "../parsers/index.js";
import { ensureFileExists } from "../utils/file.util.js";

export const extractText = asyncHandler(async (req, res) => {
  const { fileUrl, fileType } = req.body;

  const fileName = path.basename(fileUrl);
  const filePath = path.join(process.cwd(), "uploads", fileName);

  ensureFileExists(filePath);

  let text = "";

  if (fileType === "pdf") {
    text = await extractTextFromPDF(filePath);
  } else if (fileType === "image") {
    text = await extractTextFromImage(filePath);
  } else {
    return res.status(400).json({ success: false, message: "Invalid file type" });
  }

  console.log("=== EXTRACTED TEXT FROM GOOGLE VISION ===");
  console.log("Text length:", text.length);
  console.log("Full text:");
  console.log(text);
  console.log("=== END EXTRACTED TEXT ===");

  const extractedData = {
    bill_number: extractBillNumber(text),
    total_amount: extractTotalAmount(text),
  };

  console.log("\n=== EXTRACTION RESULTS ===");
  console.log("Bill Number:", extractedData.bill_number);
  console.log("Total Amount:", extractedData.total_amount);
  console.log("=== END RESULTS ===\n");

  if (!extractedData.bill_number || !extractedData.total_amount) {
    return res.status(400).json({ 
      success: false, 
      message: "Could not extract bill number or total amount.",
      debug: {
        textLength: text.length,
        textPreview: text.substring(0, 200)
      }
    });
  }

  res.json({ success: true, text, extractedData });
});