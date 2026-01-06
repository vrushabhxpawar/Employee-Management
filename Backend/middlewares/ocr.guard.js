import { isOCRServiceEnabled } from "../services/featureFlag.service.js";
import { checkOCRLimit } from "../services/ocr/ocrLimit.service.js";
import { isPaidOCRAllowed } from "../services/featureFlag.service.js";

export const ocrGuard = async (req, res, next) => {
  const serviceEnabled = await isOCRServiceEnabled();
  if (!serviceEnabled) {
    return res.status(503).json({
      message: "OCR service disabled by admin",
    });
  }

  const quota = await checkOCRLimit();
  if (!quota.allowed) {
    const paidAllowed = await isPaidOCRAllowed();
    if (!paidAllowed) {
      return res.status(429).json({
        message: "Free tier exhausted. Enable paid OCR to continue.",
        resetAt: quota.resetAt,
      });
    }
  }

  next();
};
