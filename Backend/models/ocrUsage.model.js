import mongoose from "mongoose";

const ocrUsageSchema = new mongoose.Schema({
  month: {
    type: String, // YYYY-MM
    required: true,
    unique: true,
  },
  count: {
    type: Number,
    default: 0,
  },
  limit: {
    type: Number,
    default: 1000, // free tier limit
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("OCRUsage", ocrUsageSchema);
