import mongoose from "mongoose";

const billIndexSchema = new mongoose.Schema({
  billKey: { type: String, required: true, unique: true },
  billNumber: String,
  amount: { type: Number, required: true },

  sourceFile: String,
  sourceEmployee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
  },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("BillIndex", billIndexSchema);
