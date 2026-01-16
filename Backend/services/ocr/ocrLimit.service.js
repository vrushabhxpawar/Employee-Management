import OCRUsage from "../../models/ocrUsage.model.js";

const getMonthKey = (date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
      month,
      allowed: true,
      mode: "free",
      remaining: usage.limit - usage.count,
      used: usage.count,
      limit: usage.limit,
    };
  }

  // Free exhausted
  if (!isPaidEnabled) {
    return {
      month,
      allowed: false,
      exhausted: true,
      mode: "blocked",
      resetAt: `${month}-01`,
      message: "Free OCR limit exhausted. Enable paid OCR to continue.",
    };
  }

  // Paid mode
  return {
    month,
    allowed: true,
    mode: "paid",
    pricePerRequest: 0.1,
    used: usage.paidCount,
    totalPaid: usage.paidAmount,
    limit: null,
    remaining: null,
    exhausted: true,
  };
};

// ✅ FIXED: Now accepts and uses the count parameter
export const incrementOCRUsage = async (
  { mode = "free", price = 0, count = 1, date = new Date() } = {}
) => {
  const month = getMonthKey(date);

  console.log(`📊 Incrementing OCR: mode=${mode}, count=${count}, price=${price}`);

  if (mode === "free") {
    const result = await OCRUsage.updateOne(
      { month },
      {
        $inc: { count: count }, // ✅ CHANGED: Was hardcoded to 1, now uses count parameter
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );
    console.log(`✅ Free OCR incremented by ${count}`);
    return result;
  }

  if (mode === "paid") {
    const result = await OCRUsage.updateOne(
      { month },
      {
        $inc: {
          paidCount: count, // ✅ CHANGED: Was hardcoded to 1, now uses count parameter
          paidAmount: price * count, // ✅ CHANGED: Multiply price by count
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );
    console.log(`✅ Paid OCR incremented by ${count}, total cost: ${price * count}`);
    return result;
  }
};