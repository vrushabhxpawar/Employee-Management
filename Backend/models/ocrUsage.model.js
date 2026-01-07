import mongoose from "mongoose";

const ocrUsageSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true },

  // free tier
  count: { type: Number, default: 0 },
  limit: { type: Number, default: 1000 },

  // paid tier
  paidCount: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 }, // ₹ total

  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("OCRUsage", ocrUsageSchema);
