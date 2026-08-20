import { parseMonthKey } from "./monthly.ts";

export const HISTORICAL_PERIOD_MODES = ["rolling3", "ytd", "custom"] as const;
export type HistoricalPeriodMode = (typeof HISTORICAL_PERIOD_MODES)[number];

export const MAX_CUSTOM_RANGE_MONTHS = 36;

export type HistoricalPeriodResolution =
  | {
      ok: true;
      mode: HistoricalPeriodMode;
      startMonthKey: string;
      endMonthKey: string;
      monthKeys: string[];
    }
  | {
      ok: false;
      reason:
        | "INVALID_MONTH"
        | "INVALID_CUSTOM_RANGE"
        | "CUSTOM_RANGE_TOO_LONG"
        | "UNSUPPORTED_BOUNDARY";
    };

const MIN_YEAR = 2000;
const MAX_YEAR = 2200;

function monthIndex(monthKey: string) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return null;
  const [year, month] = parsed.monthKey.split("-").map(Number);
  return year * 12 + month - 1;
}

function monthKeyFromIndex(index: number) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function enumerateMonths(startMonthKey: string, endMonthKey: string) {
  const start = monthIndex(startMonthKey);
  const end = monthIndex(endMonthKey);
  if (start === null || end === null || start > end) return null;

  const monthKeys: string[] = [];
  for (let index = start; index <= end; index += 1) {
    const monthKey = monthKeyFromIndex(index);
    if (!monthKey) return null;
    monthKeys.push(monthKey);
  }
  return monthKeys;
}

export function parseHistoricalPeriodMode(value: unknown): HistoricalPeriodMode {
  const candidate = String(value ?? "").trim();
  return HISTORICAL_PERIOD_MODES.includes(candidate as HistoricalPeriodMode)
    ? (candidate as HistoricalPeriodMode)
    : "rolling3";
}

export function resolveHistoricalPeriod(
  mode: HistoricalPeriodMode,
  selectedMonthKey: string,
  customStartMonthKey?: string,
  customEndMonthKey?: string,
): HistoricalPeriodResolution {
  const selected = parseMonthKey(selectedMonthKey);
  if (!selected) return { ok: false, reason: "INVALID_MONTH" };

  if (mode === "rolling3") {
    const endIndex = monthIndex(selected.monthKey);
    if (endIndex === null) return { ok: false, reason: "INVALID_MONTH" };
    const startMonthKey = monthKeyFromIndex(endIndex - 2);
    if (!startMonthKey) return { ok: false, reason: "UNSUPPORTED_BOUNDARY" };
    return {
      ok: true,
      mode,
      startMonthKey,
      endMonthKey: selected.monthKey,
      monthKeys: enumerateMonths(startMonthKey, selected.monthKey) ?? [],
    };
  }

  if (mode === "ytd") {
    const year = selected.monthKey.slice(0, 4);
    const startMonthKey = `${year}-01`;
    return {
      ok: true,
      mode,
      startMonthKey,
      endMonthKey: selected.monthKey,
      monthKeys: enumerateMonths(startMonthKey, selected.monthKey) ?? [],
    };
  }

  const start = parseMonthKey(customStartMonthKey);
  const end = parseMonthKey(customEndMonthKey);
  if (!start || !end) return { ok: false, reason: "INVALID_CUSTOM_RANGE" };
  const monthKeys = enumerateMonths(start.monthKey, end.monthKey);
  if (!monthKeys) return { ok: false, reason: "INVALID_CUSTOM_RANGE" };
  if (monthKeys.length > MAX_CUSTOM_RANGE_MONTHS) {
    return { ok: false, reason: "CUSTOM_RANGE_TOO_LONG" };
  }

  return {
    ok: true,
    mode,
    startMonthKey: start.monthKey,
    endMonthKey: end.monthKey,
    monthKeys,
  };
}
