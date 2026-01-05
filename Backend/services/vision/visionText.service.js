import { visionClient } from "../../config/vision.config.js";
import { checkOCRLimit, incrementOCRUsage } from "../ocr/ocrLimit.service.js";

export const extractTextFromImage = async (filePath) => {
  const quota = await checkOCRLimit();

  if (!quota.allowed) {
    const err = new Error(quota.message);
    err.statusCode = 429;
    throw err;
  }
  const [result] = await visionClient.textDetection(filePath);

  await incrementOCRUsage();

  const detections = result.textAnnotations;
  return detections?.[0]?.description || "";
};
