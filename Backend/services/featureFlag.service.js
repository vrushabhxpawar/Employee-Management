import FeatureFlag from "../models/featureFlag.model.js";

export const isOCRServiceEnabled = async () => {
  const flag = await FeatureFlag.findOne({ key: "OCR_SERVICE" });
  return flag ? flag.enabled : true;
};

export const isPaidOCRAllowed = async () => {
  const flag = await FeatureFlag.findOne({ key: "OCR_PAID_CONSENT" });
  return flag ? flag.enabled : false;
};

