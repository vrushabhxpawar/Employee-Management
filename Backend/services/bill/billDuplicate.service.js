import BillIndex from "../../models/billIndex.model.js";

export const findDuplicateBillsInSystem = async (bills) => {
  const duplicates = [];

  for (const bill of bills) {
    if (!bill?.billNo || !bill?.amount) continue;

    const exists = await BillIndex.findOne({
      billNo: bill.billNo.trim(),
      amount: bill.amount,
    });

    if (exists) {
      duplicates.push({
        billNo: bill.billNo,
        amount: bill.amount,
        sourceFile: bill.sourceFile,
        page: bill.page,
      });
    }
  }

  return duplicates; // ✅ no throw here
};
