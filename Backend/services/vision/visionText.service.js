import { visionClient } from "../../config/vision.config.js";
import { incrementOCRUsage } from "../ocr/ocrLimit.service.js";
import { isPaidOCRAllowed } from "../featureFlag.service.js";

export const extractTextFromImage = async (filePath) => {
  const paidOCR = await isPaidOCRAllowed();

  const [result] = await visionClient.textDetection(filePath);

  // ✅ OCR WAS EXECUTED — increment here
  if (!paidOCR) {
    await incrementOCRUsage();
  }

  return result.textAnnotations?.[0]?.description || "";
};
