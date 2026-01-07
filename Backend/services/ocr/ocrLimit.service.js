import OCRUsage from "../../models/ocrUsage.model.js";

const getMonthKey = (date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,"0")}`;
};

export const checkOCRLimit = async (
  date = new Date(),
  isPaidEnabled = false
) => {
  const month = getMonthKey(date);

  let usage = await OCRUsage.findOne({ month });

  if (!usage) {
    usage = await OCRUsage.create({
      month,
      count: 0,
      limit: 1000,
      paidCount: 0,
      paidAmount: 0,
    });
  }

  // Free tier available
  if (usage.count < usage.limit) {
    return {
      allowed: true,
      mode: "free",
      remaining: usage.limit - usage.count,
      used: usage.count,
      limit : usage.limit,
      
    };
  }

  // Free exhausted
  if (!isPaidEnabled) {
    return {
      allowed: false,
      exhausted: true,
      mode: "blocked",
      resetAt: `${month}-01`,
      message: "Free OCR limit exhausted. Enable paid OCR to continue.",
    };
  }

  // Paid mode
  return {
    allowed: true,
    mode: "paid",
    pricePerRequest: 0.1, 
    used : usage.paidCount,
    totalPaid: usage.paidAmount,
    limit : null,
    remaining : null,
    exhausted : true,
  };
};

export const incrementOCRUsage = async (
  { mode = "free", price = 0, date = new Date() } = {} // ✅ THIS IS THE FIX
) => {
  const month = getMonthKey(date);

  if (mode === "free") {
    await OCRUsage.updateOne(
      { month },
      {
        $inc: { count: 1 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );
  }

  if (mode === "paid") {
    await OCRUsage.updateOne(
      { month },
      {
        $inc: {
          paidCount: 1,
          paidAmount: price,
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );
  }
};
