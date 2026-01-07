import mongoose from "mongoose";

const ocrBillingSchema = new mongoose.Schema(
  {
    monthKey: { type: String, required: true, unique: true }, // "2026-01"

    freeUsed: { type: Number, default: 0 },
    paidUsed: { type: Number, default: 0 },

    costPerRequest: { type: Number, default: 1.5 }, // ₹
    totalAmount: { type: Number, default: 0 },

    paidEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("OCRBilling", ocrBillingSchema);
