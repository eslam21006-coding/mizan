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

type CalculatedExpense = CoreCalculationResult["expensesByItem"][number] & {
  parsedAmount: ExactDecimal;
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

function addSafeCount(total: number, value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || total > Number.MAX_SAFE_INTEGER - value) {
    return null;
  }
  return total + value;
}

function aggregateFunnel(entries: readonly FunnelMonthlyEntrySnapshot[]) {
  if (entries.length === 0) return null;

  let totals = {
    leads: 0,
    bookedCalls: 0,
    showedCalls: 0,
    qualifiedCalls: 0,
    sales: 0,
    newCustomers: 0,
  };

  for (const entry of entries) {
    if (
      entry.leads === null ||
      entry.booked_calls === null ||
      entry.showed_calls === null ||
      entry.qualified_calls === null ||
      entry.sales === null ||
      entry.new_customers === null
    ) {
      return null;
    }

    const leads = addSafeCount(totals.leads, entry.leads);
    const bookedCalls = addSafeCount(totals.bookedCalls, entry.booked_calls);
    const showedCalls = addSafeCount(totals.showedCalls, entry.showed_calls);
    const qualifiedCalls = addSafeCount(totals.qualifiedCalls, entry.qualified_calls);
    const sales = addSafeCount(totals.sales, entry.sales);
    const newCustomers = addSafeCount(totals.newCustomers, entry.new_customers);
    if (
      leads === null ||
      bookedCalls === null ||
      showedCalls === null ||
      qualifiedCalls === null ||
      sales === null ||
      newCustomers === null
    ) {
      return null;
    }

    totals = { leads, bookedCalls, showedCalls, qualifiedCalls, sales, newCustomers };
  }

  return totals;
}

/**
 * Converts one fully calculated historical month into the exact actual-month shape used by
 * the existing Rolling-3 Target Engine. Because expense items do not currently carry a semantic
 * media-spend marker, a positive canonical Ad Spend is separated only when exactly one acquisition
 * expense line has the same calculated amount and that line is fixed-monthly. Any ambiguous or
 * variable-media representation fails closed rather than guessing which acquisition cost is media.
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

  const calculatedExpenses: CalculatedExpense[] = [];
  for (const item of core.expensesByItem) {
    if (!item.amount.available) {
      return { status: "insufficient", blocker: "EXPENSE_AMOUNT_UNAVAILABLE" };
    }
    calculatedExpenses.push({ ...item, parsedAmount: parseDecimal(item.amount.value) });
  }

  const adSpend = parseDecimal(canonicalAdSpend);
  let mediaExpenseId: string | null = null;
  if (compare(adSpend, ZERO) > 0) {
    const matchingAcquisitionExpenses = calculatedExpenses.filter(
      (item) => item.category === "acquisition" && compare(item.parsedAmount, adSpend) === 0,
    );
    if (
      matchingAcquisitionExpenses.length !== 1 ||
      matchingAcquisitionExpenses[0].variable ||
      matchingAcquisitionExpenses[0].behavior !== "fixed_monthly"
    ) {
      return { status: "insufficient", blocker: "MEDIA_EXCEEDS_FIXED_ACQUISITION" };
    }
    mediaExpenseId = matchingAcquisitionExpenses[0].id;
  }

  let fixedNonMediaAcquisition = ZERO;
  let variableAcquisition = ZERO;
  let fixedNonAcquisition = ZERO;
  let variableNonAcquisition = ZERO;

  for (const item of calculatedExpenses) {
    if (item.category === "acquisition") {
      if (item.id === mediaExpenseId) continue;
      if (item.variable) variableAcquisition = add(variableAcquisition, item.parsedAmount);
      else fixedNonMediaAcquisition = add(fixedNonMediaAcquisition, item.parsedAmount);
    } else if (item.variable) {
      variableNonAcquisition = add(variableNonAcquisition, item.parsedAmount);
    } else {
      fixedNonAcquisition = add(fixedNonAcquisition, item.parsedAmount);
    }
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
