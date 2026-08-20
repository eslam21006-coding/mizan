const ARABIC_NUMBER_FORMATTER = new Intl.NumberFormat("ar-EG");

export function formatArabicRemainingMonths(remaining: number) {
  if (!Number.isSafeInteger(remaining) || remaining <= 0) return "";
  if (remaining === 1) return "وشهر آخر";
  if (remaining === 2) return "وشهران آخران";

  const count = ARABIC_NUMBER_FORMATTER.format(remaining);
  if (remaining <= 10) return `و${count} أشهر أخرى`;
  return `و${count} شهرًا آخر`;
}
