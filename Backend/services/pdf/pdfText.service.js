import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import { extractBillNumber, extractTotalAmount } from "../../parsers/index.js";
import { extractTextFromImage } from "../vision/visionText.service.js";

const execPromise = promisify(exec);

const convertPdfToImages = async (pdfPath) => {
  const outputPrefix = path.join(
    os.tmpdir(),
    `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // ✅ OPTIMIZED: Lower resolution (72 DPI instead of 150) + JPEG (faster than PNG)
  // DPI 72 is still good enough for OCR and 5x faster
  const command = `pdftoppm -jpeg -r 72 "${pdfPath}" "${outputPrefix}"`;

  try {
    await execPromise(command);
    return outputPrefix;
  } catch (error) {
    throw new Error(`PDF conversion failed: ${error.message}`);
  }
};

const getAllImagePaths = (prefix) => {
  const tmpDir = path.dirname(prefix);
  const baseName = path.basename(prefix);

  const files = fs.readdirSync(tmpDir);
  const imagePaths = files
    .filter((file) => file.startsWith(baseName) && (file.endsWith(".jpg") || file.endsWith(".jpeg"))) // ✅ Changed from .png
    .map((file) => path.join(tmpDir, file))
    .sort();

  return imagePaths;
};

const processPage = async (imgPath, pageIndex) => {
  try {
    const text = await extractTextFromImage(imgPath);

    const billNo = extractBillNumber(text);
    const amount = extractTotalAmount(text);

    let confidence = "high";
    if (!billNo && !amount) confidence = "low";
    else if (!billNo || !amount) confidence = "medium";

    return {
      page: pageIndex + 1,
      billNo: billNo || null,
      amount: amount || null,
      confidence,
    };
  } finally {
    if (fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
    }
  }
};

const cleanupImages = (imagePaths) => {
  for (const imgPath of imagePaths) {
    try {
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    } catch (err) {
      console.error(`Failed to delete ${imgPath}:`, err);
    }
  }
};

export const extractTextFromPDF = async (pdfPath) => {
  let imagePaths = [];

  try {
    console.time("⏱️ PDF Conversion");
    const prefix = await convertPdfToImages(pdfPath);
    console.timeEnd("⏱️ PDF Conversion");

    console.time("⏱️ Get Image Paths");
    imagePaths = getAllImagePaths(prefix);
    console.timeEnd("⏱️ Get Image Paths");

    if (imagePaths.length === 0) {
      throw new Error("No pages could be extracted from PDF");
    }

    console.log(`📄 Processing ${imagePaths.length} pages in parallel...`);
    console.time("⏱️ Parallel OCR Processing");

    // ✅ SIMPLE PARALLEL PROCESSING - Process all pages at once
    const CONCURRENT_LIMIT = 3; // Process 3 pages simultaneously
    const bills = [];

    for (let i = 0; i < imagePaths.length; i += CONCURRENT_LIMIT) {
      const batch = imagePaths.slice(i, i + CONCURRENT_LIMIT);
      console.time(`⏱️ Batch ${Math.floor(i / CONCURRENT_LIMIT) + 1}`);

      const batchResults = await Promise.all(
        batch.map((imgPath, batchIndex) => processPage(imgPath, i + batchIndex))
      );

      bills.push(...batchResults);
      console.timeEnd(`⏱️ Batch ${Math.floor(i / CONCURRENT_LIMIT) + 1}`);

      console.log(
        `✅ Processed pages ${i + 1}-${Math.min(i + CONCURRENT_LIMIT, imagePaths.length)} of ${imagePaths.length}`
      );
    }

    console.timeEnd("⏱️ Parallel OCR Processing");

    return {
      totalBillsDetected: bills.length,
      bills,
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw error;
  } finally {
    cleanupImages(imagePaths);
  }
};