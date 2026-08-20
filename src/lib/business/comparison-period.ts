import { parseMonthKey, shiftMonthKey } from "./monthly.ts";

export function resolvePreviousComparisonMonth(monthKey: string) {
  const previousMonthKey = shiftMonthKey(monthKey, -1);
  if (!previousMonthKey) {
    return { monthKey: null, parsed: null };
  }

  return {
    monthKey: previousMonthKey,
    parsed: parseMonthKey(previousMonthKey),
  };
}
