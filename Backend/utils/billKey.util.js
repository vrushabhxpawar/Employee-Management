export const generateBillKey = ({ billNo, amount }) => {
  if (!amount) return null;

  const normalizedBillNo = billNo
    ? billNo.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
    : "NO_BILL_NO";

  return `${normalizedBillNo}__${amount}`;
};
