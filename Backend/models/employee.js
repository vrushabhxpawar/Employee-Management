import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    billNo: String,
    amount: Number,
    page: Number,
    confidence: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
  },
  { _id: false }
);


const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    files: [
      {
        url: String,
        filename: String,
        path: String,
        fileHash: { type: String, index: true },
        extractedBills: [billSchema],
      },
    ],
  },
  { timestamps: true }
);

employeeSchema.index({ "files.fileHash": 1 });


const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;
