import fs from "fs";
import { exec } from "child_process";
import path from "path";
import os from "os";
import { extractBillNumber, extractTotalAmount } from "../../parsers/index.js";
import { extractTextFromImage } from "../vision/visionText.service.js";

/* ================= PDF → IMAGE ================= */

const convertPdfToImages = (pdfPath) => {
  return new Promise((resolve, reject) => {
    const outputPrefix = path.join(os.tmpdir(), `pdf_${Date.now()}`);
    const command = `pdftoppm -png -r 300 "${pdfPath}" "${outputPrefix}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) return reject(stderr || error);
      resolve(outputPrefix);
    });
  });
};

/* ================= MAIN SERVICE ================= */

export const extractTextFromPDF = async (pdfPath) => {
  const prefix = await convertPdfToImages(pdfPath);

  const bills = [];
  let page = 1;

  try {
    while (true) {
      const imgPath = `${prefix}-${page}.png`;
      if (!fs.existsSync(imgPath)) break;

      const text = await extractTextFromImage(imgPath);
      console.log(`\n===== PDF PAGE ${page} OCR TEXT =====`);
      console.log(text);
      console.log("===== END OCR TEXT =====\n");

      // ✅ Use the new improved parsers
      const billNo = extractBillNumber(text);
      const amount = extractTotalAmount(text);

      // Determine confidence based on what was extracted
      let confidence = 'high';
      if (!billNo && !amount) {
        confidence = 'low';
      } else if (!billNo || !amount) {
        confidence = 'medium';
      }

      bills.push({
        page,
        billNo: billNo || null,
        amount: amount || null,
        confidence,
      });

      fs.unlinkSync(imgPath);
      page++;
    }

    return {
      totalBillsDetected: bills.length,
      bills,
    };
  } finally {
    // Safety cleanup
    let i = 1;
    while (true) {
      const imgPath = `${prefix}-${i}.png`;
      if (!fs.existsSync(imgPath)) break;
      fs.unlinkSync(imgPath);
      i++;
    }
  }
};