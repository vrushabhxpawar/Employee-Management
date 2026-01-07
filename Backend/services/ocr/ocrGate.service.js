import {
  isOCRServiceEnabled,
  isPaidOCRAllowed,
} from "../featureFlag.service.js";
import { checkOCRLimit } from "./ocrLimit.service.js";

export const assertOCRAllowed = async () => {
  // 1️⃣ Kill switch (only blocks if explicitly disabled)
  const enabled = await isOCRServiceEnabled();
  if (!enabled) {
    const err = new Error("OCR service is disabled");
    err.statusCode = 503;
    throw err;
  }

  // 2️⃣ Paid bypass
  const paid = await isPaidOCRAllowed();
  if (paid) {
    return { billing: "paid" };
  }

  // 3️⃣ Free quota
  const quota = await checkOCRLimit();
  if (!quota.allowed) {
    const err = new Error("Free OCR limit exceeded");
    err.statusCode = 429;
    err.meta = quota;
    throw err;
  }

  return { billing: "free", quota };
};
