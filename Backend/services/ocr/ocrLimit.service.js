import OCRUsage from "../../models/ocrUsage.model.js";

const getMonthKey = (date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const checkOCRLimit = async (date = new Date()) => {
  const month = getMonthKey(date);

  let usage = await OCRUsage.findOne({ month });

  if (!usage) {
    usage = await OCRUsage.create({
      month,
      count: 0,
      limit: 1000,
    });
  }

  if (usage.count >= usage.limit) {
    return {
      allowed: false,
      exhausted : true,
      remaining: 0,
      resetAt: `${month}-01`,
      pricePerRequest : 2,
      message:
        "You have reached the free OCR limit for this month. Please try again next month.",
    };
  }

  return {
    allowed: true,
    remaining: usage.limit - usage.count,
    used: usage.count,
  };
};

export const incrementOCRUsage = async (date = new Date()) => {
  const month = getMonthKey(date);

  await OCRUsage.updateOne(
    { month },
    {
      $inc: { count: 1 },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );
};
