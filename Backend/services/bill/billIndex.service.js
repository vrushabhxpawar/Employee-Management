import BillIndex from "../../models/billIndex.model.js";
import { generateBillKey } from "../../utils/billKey.util.js";

export const saveBillIndex = async ({
  billNo,
  amount,
  vendor,
  sourceFile,
  sourceEmployee,
}) => {
  if (!billNo || !amount) return;

  const billKey = generateBillKey({ billNo, amount });
  if (!billKey) return;

  await BillIndex.create({
    billNumber: billNo.trim(),
    amount,
    vendor,
    sourceFile,
    sourceEmployee,
    billKey, // ✅ ALWAYS PRESENT
  });
};
