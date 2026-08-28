import type { CoreCalculationResult } from "./calculations.ts";
import type { FunnelMonthlyEntrySnapshot } from "./funnel-month.ts";
import type { Rolling3TargetActualMonth } from "./target-engine.ts";

export type TargetPlannerActualMonthBlocker =
  | "CORE_METRIC_UNAVAILABLE"
  | "EXPENSE_AMOUNT_UNAVAILABLE"
  | "AD_SPEND_UNAVAILABLE"
  | "MEDIA_EXCEEDS_FIXED_ACQUISITION"
  | "FUNNEL_DATA_UNAVAILABLE"
  | "FUNNEL_CUSTOMER_MISMATCH"
  | "FUNNEL_SEQUENCE_INVALID";

export type TargetPlannerActualMonthResult =
  | { status: "ready"; actual: Rolling3TargetActualMonth }
  | { status: "insufficient"; blocker: TargetPlannerActualMonthBlocker };

type ExactDecimal = {
  coefficient: bigint;
  scale: number;
};

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;
const ZERO: ExactDecimal = { coefficient: 0n, scale: 0 };

function powerOfTen(exponent: number) {
  return 10n ** BigInt(exponent);
}

function normalizeDecimal(value: ExactDecimal): ExactDecimal {
  if (value.coefficient === 0n) return ZERO;
  let coefficient = value.coefficient;
  let scale = value.scale;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

function parseDecimal(value: string): ExactDecimal {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) throw new Error(`Invalid canonical decimal: ${value}`);
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  return normalizeDecimal({
    coefficient: BigInt(`${whole}${fraction}` || "0") * (negative ? -1n : 1n),
    scale: fraction.length,
  });
}

function align(left: ExactDecimal, right: ExactDecimal) {
  const scale = Math.max(left.scale, right.scale);
  return {
    left: left.coefficient * powerOfTen(scale - left.scale),
    right: right.coefficient * powerOfTen(scale - right.scale),
    scale,
  };
}

function add(left: ExactDecimal, right: ExactDecimal) {
  const aligned = align(left, right);
  return normalizeDecimal({ coefficient: aligned.left + aligned.right, scale: aligned.scale });
}

function subtract(left: ExactDecimal, right: ExactDecimal) {
  const aligned = align(left, right);
  return normalizeDecimal({ coefficient: aligned.left - aligned.right, scale: aligned.scale });
}

function compare(left: ExactDecimal, right: ExactDecimal) {
  const aligned = align(left, right);
  return aligned.left === aligned.right ? 0 : aligned.left > aligned.right ? 1 : -1;
}

function decimalToString(value: ExactDecimal) {
  const normalized = normalizeDecimal(value);
  const negative = normalized.coefficient < 0n;
  const digits = (negative ? -normalized.coefficient : normalized.coefficient).toString();
  if (normalized.scale === 0) return `${negative ? "-" : ""}${digits}`;
  const padded = digits.padStart(normalized.scale + 1, "0");
  const splitAt = padded.length - normalized.scale;
  return `${negative ? "-" : ""}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
}

function safeAddCount(total: number, value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || total > Number.MAX_SAFE_INTEGER - value) {
    throw new Error("Target planner funnel count is outside the safe integer boundary.");
  }
  return total + value;
}

function aggregateFunnel(entries: readonly FunnelMonthlyEntrySnapshot[]) {
  if (entries.length === 0) return null;
  const requiredFields = [
    "leads",
    "booked_calls",
    "showed_calls",
    "qualified_calls",
    "sales",
    "new_customers",
  ] as const;
  if (entries.some((entry) => requiredFields.some((field) => entry[field] === null))) return null;

  return entries.reduce(
    (total, entry) => ({
      leads: safeAddCount(total.leads, entry.leads as number),
      bookedCalls: safeAddCount(total.bookedCalls, entry.booked_calls as number),
      showedCalls: safeAddCount(total.showedCalls, entry.showed_calls as number),
      qualifiedCalls: safeAddCount(total.qualifiedCalls, entry.qualified_calls as number),
      sales: safeAddCount(total.sales, entry.sales as number),
      newCustomers: safeAddCount(total.newCustomers, entry.new_customers as number),
    }),
    { leads: 0, bookedCalls: 0, showedCalls: 0, qualifiedCalls: 0, sales: 0, newCustomers: 0 },
  );
}

/**
 * Converts one fully calculated historical month into the exact actual-month shape used by
 * the existing Rolling-3 Target Engine. Media spend is kept separate from non-media acquisition
 * costs so the planner does not double-count advertising when it projects required Ad Spend.
 */
export function buildTargetPlannerActualMonth(input: {
  month: string;
  core: CoreCalculationResult;
  canonicalAdSpend: string | null;
  funnelEntries: readonly FunnelMonthlyEntrySnapshot[];
}): TargetPlannerActualMonthResult {
  const { month, core, canonicalAdSpend, funnelEntries } = input;
  if (!core.netCashCollected.available || !core.newCustomers.available) {
    return { status: "insufficient", blocker: "CORE_METRIC_UNAVAILABLE" };
  }
  if (canonicalAdSpend === null) {
    return { status: "insufficient", blocker: "AD_SPEND_UNAVAILABLE" };
  }

  let totalAcquisition = ZERO;
  let variableAcquisition = ZERO;
  let totalNonAcquisition = ZERO;
  let variableNonAcquisition = ZERO;

  for (const item of core.expensesByItem) {
    if (!item.amount.available) {
      return { status: "insufficient", blocker: "EXPENSE_AMOUNT_UNAVAILABLE" };
    }
    const amount = parseDecimal(item.amount.value);
    if (item.category === "acquisition") {
      totalAcquisition = add(totalAcquisition, amount);
      if (item.variable) variableAcquisition = add(variableAcquisition, amount);
    } else {
      totalNonAcquisition = add(totalNonAcquisition, amount);
      if (item.variable) variableNonAcquisition = add(variableNonAcquisition, amount);
    }
  }

  const adSpend = parseDecimal(canonicalAdSpend);
  const fixedAcquisitionBeforeMedia = subtract(totalAcquisition, variableAcquisition);
  const fixedNonMediaAcquisition = subtract(fixedAcquisitionBeforeMedia, adSpend);
  if (compare(fixedNonMediaAcquisition, ZERO) < 0) {
    return { status: "insufficient", blocker: "MEDIA_EXCEEDS_FIXED_ACQUISITION" };
  }
  const fixedNonAcquisition = subtract(totalNonAcquisition, variableNonAcquisition);
  if (compare(fixedNonAcquisition, ZERO) < 0) {
    return { status: "insufficient", blocker: "EXPENSE_AMOUNT_UNAVAILABLE" };
  }

  const funnel = aggregateFunnel(funnelEntries);
  if (!funnel) return { status: "insufficient", blocker: "FUNNEL_DATA_UNAVAILABLE" };
  if (funnel.newCustomers !== core.newCustomers.value) {
    return { status: "insufficient", blocker: "FUNNEL_CUSTOMER_MISMATCH" };
  }
  if (
    funnel.bookedCalls > funnel.leads ||
    funnel.showedCalls > funnel.bookedCalls ||
    funnel.qualifiedCalls > funnel.showedCalls ||
    funnel.sales > funnel.qualifiedCalls ||
    funnel.newCustomers > funnel.sales
  ) {
    return { status: "insufficient", blocker: "FUNNEL_SEQUENCE_INVALID" };
  }

  return {
    status: "ready",
    actual: {
      month,
      netCashCollected: core.netCashCollected.value,
      newCustomers: core.newCustomers.value,
      adSpend: canonicalAdSpend,
      fixedAcquisitionCosts: decimalToString(fixedNonMediaAcquisition),
      fixedNonAcquisitionCosts: decimalToString(fixedNonAcquisition),
      variableNonMediaAcquisitionCosts: decimalToString(variableAcquisition),
      variableNonAcquisitionCosts: decimalToString(variableNonAcquisition),
      leads: funnel.leads,
      bookedCalls: funnel.bookedCalls,
      showedCalls: funnel.showedCalls,
      qualifiedCalls: funnel.qualifiedCalls,
      sales: funnel.sales,
    },
  };
}
