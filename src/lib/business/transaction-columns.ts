export function transactionColumnLabel(index: number) {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError("Transaction column index must be a non-negative integer.");
  }

  let value = index + 1;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}
