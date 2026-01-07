import FeatureFlag from "../models/featureFlag.model.js";

export const isOCRServiceEnabled = async () => {
  const flag = await FeatureFlag.findOne({ key: "OCR_SERVICE" });

  // Default: ENABLED
  if (!flag) return true;

  return flag.enabled === true;
};

export const isPaidOCRAllowed = async () => {
  const flag = await FeatureFlag.findOne({ key: "OCR_PAID_CONSENT" });

  // Default: DISABLED
  if (!flag) return false;

  return flag.enabled === true;
};

