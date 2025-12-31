import { visionClient } from "../../config/vision.config.js";

export const extractTextFromImage = async (filePath) => {
  const [result] = await visionClient.textDetection(filePath);
  const detections = result.textAnnotations;
  return detections?.[0]?.description || "";
};
