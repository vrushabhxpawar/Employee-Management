import { visionClient } from "../../config/vision.config.js";

export const extractTextFromImage = async (filePath) => {
  try {
    const [result] = await visionClient.textDetection(filePath);
    return result.textAnnotations?.[0]?.description || "";
  } catch (error) {
    console.error(`OCR error for ${filePath}:`, error.message);
    return "";
  }
};