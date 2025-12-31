import fs from "fs";
import { extractTextFromImage } from "../vision/visionText.service.js";

import { exec } from "child_process";
import path from "path";
import os from "os";

const convertPdfToImages = (pdfPath) => {
  return new Promise((resolve, reject) => {
    const outputPrefix = path.join(
      os.tmpdir(),
      `pdf_${Date.now()}`
    );

    const command = `pdftoppm -png -r 300 "${pdfPath}" "${outputPrefix}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(stderr || error);
      }

      resolve(outputPrefix);
    });
  });
};


export const extractTextFromPDF = async (pdfPath) => {
  const prefix = await convertPdfToImages(pdfPath);

  let finalText = "";

  let page = 1;
  while (true) {
    const imgPath = `${prefix}-${page}.png`;
    if (!fs.existsSync(imgPath)) break;

    const text = await extractTextFromImage(imgPath);
    finalText += `\n\n===== PAGE ${page} =====\n\n${text}`;

    fs.unlinkSync(imgPath);
    page++;
  }

  return finalText;
};
