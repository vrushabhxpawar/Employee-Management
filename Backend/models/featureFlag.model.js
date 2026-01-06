import mongoose from "mongoose";

const featureFlagSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("FeatureFlag", featureFlagSchema);
