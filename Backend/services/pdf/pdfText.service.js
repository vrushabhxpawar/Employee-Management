import fs from "fs";
import { exec } from "child_process";
import path from "path";
import os from "os";
import { extractBillNumber, extractTotalAmount } from "../../parsers/index.js";
import { extractTextFromImage } from "../vision/visionText.service.js";
import BillIndex from "../../models/billIndex.model.js";

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

      const billNo = extractBillNumber(text);
      const amount = extractTotalAmount(text);

      let confidence = "high";
      if (!billNo && !amount) confidence = "low";
      else if (!billNo || !amount) confidence = "medium";

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
    let i = 1;
    while (true) {
      const imgPath = `${prefix}-${i}.png`;
      if (!fs.existsSync(imgPath)) break;
      fs.unlinkSync(imgPath);
      i++;
    }
  }
};
