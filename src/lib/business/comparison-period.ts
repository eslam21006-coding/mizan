export type ComparisonMonth = {
  monthKey: string;
  monthStart: string;
};

function parseSupportedMonthKey(value: string): ComparisonMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2200 || month < 1 || month > 12) return null;

  const normalizedMonthKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  return {
    monthKey: normalizedMonthKey,
    monthStart: `${normalizedMonthKey}-01`,
  };
}

export function resolvePreviousComparisonMonth(monthKey: string) {
  const selectedMonth = parseSupportedMonthKey(monthKey);
  if (!selectedMonth) return { monthKey: null, parsed: null };

  const [year, month] = selectedMonth.monthKey.split("-").map(Number);
  const previousDate = new Date(Date.UTC(year, month - 2, 1));
  const previousMonthKey = `${previousDate.getUTCFullYear()}-${String(previousDate.getUTCMonth() + 1).padStart(2, "0")}`;

  return {
    monthKey: previousMonthKey,
    parsed: parseSupportedMonthKey(previousMonthKey),
  };
}
