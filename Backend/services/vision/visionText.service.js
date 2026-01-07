import { visionClient } from "../../config/vision.config.js";
import { incrementOCRUsage } from "../ocr/ocrLimit.service.js";

export const extractTextFromImage = async (filePath) => {
  const [result] = await visionClient.textDetection(filePath);
  return result.textAnnotations?.[0]?.description || "";
};

