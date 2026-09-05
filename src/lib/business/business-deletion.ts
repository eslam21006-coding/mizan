export function isBusinessDeletionConfirmation(value: unknown) {
  if (typeof value !== "string") return false;

  const normalized = value.trim();
  return normalized === "حذف" || normalized.toLowerCase() === "delete";
}
