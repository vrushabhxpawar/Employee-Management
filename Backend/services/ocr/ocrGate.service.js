import {
  isOCRServiceEnabled,
  isPaidOCRAllowed,
} from "../featureFlag.service.js";
import { checkOCRLimit } from "./ocrLimit.service.js";

export const assertOCRAllowed = async () => {
  // 1️⃣ Paid OCR always wins
  const paid = await isPaidOCRAllowed();
  if (paid === true) {
    return { billing: "paid" };
  }

  // 2️⃣ Admin kill switch (free OCR only)
  const enabled = await isOCRServiceEnabled();
  if (!enabled) {
    const err = new Error("Free OCR service is disabled");
    err.statusCode = 503;
    throw err;
  }

  // 3️⃣ Free-tier quota
  const quota = await checkOCRLimit();
  if (!quota.allowed) {
    const err = new Error(quota.message);
    err.statusCode = 429;
    err.meta = quota;
    throw err;
  }

  return { billing: "free", quota };
};
