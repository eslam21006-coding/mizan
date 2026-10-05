import { currentMonthKeyForTimeZone, parseMonthKey } from "./monthly.ts";

export type FirstMonthResumeMonths = {
  savedMonthKeys: readonly string[];
  completedMonthKeys: readonly string[];
};

/** Strictly resolves one Setup Step 4 month, distinguishing absent, valid, and malformed URL values. */
export function resolveFirstMonthSelection(
  rawMonth: string | string[] | undefined,
  timeZone: string,
  now = new Date(),
) {
  const defaultMonthKey = currentMonthKeyForTimeZone(timeZone, now);
  if (rawMonth === undefined) return { kind: "default" as const, monthKey: defaultMonthKey };
  if (Array.isArray(rawMonth)) return { kind: "invalid" as const, monthKey: defaultMonthKey };
  const parsed = parseMonthKey(rawMonth);
  return parsed
    ? { kind: "valid" as const, monthKey: parsed.monthKey }
    : { kind: "invalid" as const, monthKey: defaultMonthKey };
}

/**
 * Resolves Setup Step 4's ordinary resume month from persisted facts only.
 * Explicit valid URL months win; only a missing month can resume a saved incomplete month.
 */
export function resolveResumableFirstMonthSelection(
  rawMonth: string | string[] | undefined,
  timeZone: string,
  persistedMonths: FirstMonthResumeMonths,
  now = new Date(),
) {
  const parsed = resolveFirstMonthSelection(rawMonth, timeZone, now);
  if (parsed.kind !== "default") return parsed;

  const complete = new Set(persistedMonths.completedMonthKeys);
  let latestIncompleteMonth: string | null = null;
  for (const candidate of persistedMonths.savedMonthKeys) {
    const month = parseMonthKey(candidate);
    if (!month || month.monthKey > parsed.monthKey || complete.has(month.monthKey)) continue;
    if (latestIncompleteMonth === null || month.monthKey > latestIncompleteMonth) {
      latestIncompleteMonth = month.monthKey;
    }
  }

  return latestIncompleteMonth
    ? { kind: "default" as const, monthKey: latestIncompleteMonth }
    : parsed;
}
