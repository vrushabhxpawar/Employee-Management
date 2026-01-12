import mongoose from "mongoose";

const billIndexSchema = new mongoose.Schema({
  billKey: { type: String, required: true, unique: true },
  billNumber: String,
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["processing", "completed", "failed"],
    default: "processing",
  },
  sourceFile: String,
  sourceEmployee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",  
  },
  error: {
    type: String,
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("BillIndex", billIndexSchema);
