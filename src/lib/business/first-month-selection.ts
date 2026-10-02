import { currentMonthKeyForTimeZone, parseMonthKey } from "./monthly.ts";

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
