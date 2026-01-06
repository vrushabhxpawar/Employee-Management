import BillIndex from "../../models/billIndex.model.js";

export const isDuplicateBill = async (bill) => {
  if (!bill?.billNo || !bill?.amount) return false;

  return await BillIndex.findOne({
    billNo: bill.billNo.trim(),
    amount: bill.amount,
  });
};
