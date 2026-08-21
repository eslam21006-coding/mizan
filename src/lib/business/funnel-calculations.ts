import type { ExactRatio } from "./calculations.ts";

export type FunnelMetricUnavailableReason =
  | "INPUT_UNAVAILABLE"
  | "NO_LEADS"
  | "NO_BOOKED_CALLS"
  | "NO_SHOWED_CALLS"
  | "NO_QUALIFIED_CALLS"
  | "NO_NEW_CUSTOMERS"
  | "NO_AD_SPEND"
  | "ATTRIBUTION_UNAVAILABLE";

export type FunnelMetric<T> =
  | { available: true; value: T }
  | { available: false; reason: FunnelMetricUnavailableReason };

export type FunnelHealth = "healthy" | "below_benchmark" | "unavailable";

export type FunnelCalculationInput = {
  adSpend: string | null;
  leads: number | null;
  bookedCalls: number | null;
  showedCalls: number | null;
  qualifiedCalls: number | null;
  sales: number | null;
  newCustomers: number | null;
  cashCollected: string | null;
  attributedRevenue: string | null;
};

export type FunnelCalculationResult = {
  cpl: FunnelMetric<ExactRatio>;
  costPerBooking: FunnelMetric<ExactRatio>;
  costPerShow: FunnelMetric<ExactRatio>;
  costPerQualifiedCall: FunnelMetric<ExactRatio>;
  showRate: FunnelMetric<ExactRatio>;
  qualificationRate: FunnelMetric<ExactRatio>;
  closeRate: FunnelMetric<ExactRatio>;
  leadToSaleRate: FunnelMetric<ExactRatio>;
  mediaCac: FunnelMetric<ExactRatio>;
  roas: FunnelMetric<ExactRatio>;
  showRateHealth: FunnelHealth;
  closeRateHealth: FunnelHealth;
};

export type AdSpendReconciliationStatus =
  | "matched"
  | "mismatch"
  | "business_only"
  | "funnel_only"
  | "incomplete";

export type AdSpendReconciliationResult = {
  canonicalAdSpend: FunnelMetric<string>;
  businessAdSpend: FunnelMetric<string>;
  funnelAdSpendTotal: FunnelMetric<string>;
  difference: FunnelMetric<string>;
  status: AdSpendReconciliationStatus;
};

type ExactDecimal = {
  coefficient: bigint;
  scale: number;
};

const ZERO: ExactDecimal = { coefficient: 0n, scale: 0 };
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

export class FunnelCalculationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FunnelCalculationInputError";
  }
}

function available<T>(value: T): FunnelMetric<T> {
  return { available: true, value };
}

function unavailable<T>(reason: FunnelMetricUnavailableReason): FunnelMetric<T> {
  return { available: false, reason };
}

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

function parseDecimal(value: string, fieldName: string, allowNegative = false): ExactDecimal {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new FunnelCalculationInputError(`${fieldName} must be a canonical decimal string.`);
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const parsed = normalizeDecimal({
    coefficient: BigInt(`${whole}${fraction}` || "0") * (negative ? -1n : 1n),
    scale: fraction.length,
  });

  if (!allowNegative && parsed.coefficient < 0n) {
    throw new FunnelCalculationInputError(`${fieldName} cannot be negative.`);
  }
  return parsed;
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

function alignScales(left: ExactDecimal, right: ExactDecimal) {
  const scale = Math.max(left.scale, right.scale);
  return {
    left: left.coefficient * powerOfTen(scale - left.scale),
    right: right.coefficient * powerOfTen(scale - right.scale),
    scale,
  };
}

function add(left: ExactDecimal, right: ExactDecimal) {
  const aligned = alignScales(left, right);
  return normalizeDecimal({ coefficient: aligned.left + aligned.right, scale: aligned.scale });
}

function subtract(left: ExactDecimal, right: ExactDecimal) {
  const aligned = alignScales(left, right);
  return normalizeDecimal({ coefficient: aligned.left - aligned.right, scale: aligned.scale });
}

function compare(left: ExactDecimal, right: ExactDecimal) {
  const aligned = alignScales(left, right);
  return aligned.left === aligned.right ? 0 : aligned.left > aligned.right ? 1 : -1;
}

function gcd(left: bigint, right: bigint) {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function exactRatio(numerator: ExactDecimal, denominator: ExactDecimal): ExactRatio {
  if (denominator.coefficient === 0n) {
    throw new FunnelCalculationInputError("Cannot construct a ratio with a zero denominator.");
  }
  let numeratorInteger = numerator.coefficient * powerOfTen(denominator.scale);
  let denominatorInteger = denominator.coefficient * powerOfTen(numerator.scale);
  if (denominatorInteger < 0n) {
    numeratorInteger *= -1n;
    denominatorInteger *= -1n;
  }
  if (numeratorInteger === 0n) return { numerator: "0", denominator: "1" };
  const divisor = gcd(numeratorInteger, denominatorInteger);
  return {
    numerator: (numeratorInteger / divisor).toString(),
    denominator: (denominatorInteger / divisor).toString(),
  };
}

function count(value: number | null, fieldName: string): FunnelMetric<number> {
  if (value === null) return unavailable("INPUT_UNAVAILABLE");
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new FunnelCalculationInputError(`${fieldName} must be a non-negative safe integer.`);
  }
  return available(value);
}

function decimal(value: string | null, fieldName: string, allowNegative = false) {
  return value === null
    ? unavailable<ExactDecimal>("INPUT_UNAVAILABLE")
    : available(parseDecimal(value, fieldName, allowNegative));
}

function ratioByCount(
  numerator: FunnelMetric<ExactDecimal>,
  denominator: FunnelMetric<number>,
  zeroReason: FunnelMetricUnavailableReason,
): FunnelMetric<ExactRatio> {
  if (!denominator.available) return unavailable("INPUT_UNAVAILABLE");
  if (denominator.value === 0) return unavailable(zeroReason);
  if (!numerator.available) return unavailable("INPUT_UNAVAILABLE");
  return available(
    exactRatio(numerator.value, { coefficient: BigInt(denominator.value), scale: 0 }),
  );
}

function ratioCounts(
  numerator: FunnelMetric<number>,
  denominator: FunnelMetric<number>,
  zeroReason: FunnelMetricUnavailableReason,
): FunnelMetric<ExactRatio> {
  if (!denominator.available) return unavailable("INPUT_UNAVAILABLE");
  if (denominator.value === 0) return unavailable(zeroReason);
  if (!numerator.available) return unavailable("INPUT_UNAVAILABLE");
  return available({
    numerator: String(numerator.value),
    denominator: String(denominator.value),
  });
}

function healthAbove(metric: FunnelMetric<ExactRatio>, thresholdPercent: bigint): FunnelHealth {
  if (!metric.available) return "unavailable";
  const numerator = BigInt(metric.value.numerator);
  const denominator = BigInt(metric.value.denominator);
  return numerator * 100n > denominator * thresholdPercent ? "healthy" : "below_benchmark";
}

export function calculateFunnelMetrics(input: FunnelCalculationInput): FunnelCalculationResult {
  const adSpend = decimal(input.adSpend, "adSpend");
  const leads = count(input.leads, "leads");
  const bookedCalls = count(input.bookedCalls, "bookedCalls");
  const showedCalls = count(input.showedCalls, "showedCalls");
  const qualifiedCalls = count(input.qualifiedCalls, "qualifiedCalls");
  const sales = count(input.sales, "sales");
  const newCustomers = count(input.newCustomers, "newCustomers");
  decimal(input.cashCollected, "cashCollected");

  const attributedRevenue =
    input.attributedRevenue === null
      ? unavailable<ExactDecimal>("ATTRIBUTION_UNAVAILABLE")
      : available(parseDecimal(input.attributedRevenue, "attributedRevenue", true));

  const showRate = ratioCounts(showedCalls, bookedCalls, "NO_BOOKED_CALLS");
  const closeRate = ratioCounts(sales, qualifiedCalls, "NO_QUALIFIED_CALLS");

  const roas = (() => {
    if (!attributedRevenue.available) return unavailable<ExactRatio>("ATTRIBUTION_UNAVAILABLE");
    if (!adSpend.available) return unavailable<ExactRatio>("INPUT_UNAVAILABLE");
    if (compare(adSpend.value, ZERO) === 0) return unavailable<ExactRatio>("NO_AD_SPEND");
    return available(exactRatio(attributedRevenue.value, adSpend.value));
  })();

  return {
    cpl: ratioByCount(adSpend, leads, "NO_LEADS"),
    costPerBooking: ratioByCount(adSpend, bookedCalls, "NO_BOOKED_CALLS"),
    costPerShow: ratioByCount(adSpend, showedCalls, "NO_SHOWED_CALLS"),
    costPerQualifiedCall: ratioByCount(adSpend, qualifiedCalls, "NO_QUALIFIED_CALLS"),
    showRate,
    qualificationRate: ratioCounts(qualifiedCalls, showedCalls, "NO_SHOWED_CALLS"),
    closeRate,
    leadToSaleRate: ratioCounts(sales, leads, "NO_LEADS"),
    mediaCac: ratioByCount(adSpend, newCustomers, "NO_NEW_CUSTOMERS"),
    roas,
    showRateHealth: healthAbove(showRate, 65n),
    closeRateHealth: healthAbove(closeRate, 20n),
  };
}

export function reconcileBusinessAdSpend(
  businessAdSpend: string | null,
  funnelAdSpends: readonly (string | null)[],
): AdSpendReconciliationResult {
  const business =
    businessAdSpend === null
      ? unavailable<ExactDecimal>("INPUT_UNAVAILABLE")
      : available(parseDecimal(businessAdSpend, "businessAdSpend"));

  const funnelTotal = (() => {
    if (funnelAdSpends.length === 0 || funnelAdSpends.some((value) => value === null)) {
      return unavailable<ExactDecimal>("INPUT_UNAVAILABLE");
    }
    return available(
      funnelAdSpends.reduce(
        (sum, value, index) => add(sum, parseDecimal(value as string, `funnelAdSpend[${index}]`)),
        ZERO,
      ),
    );
  })();

  const canonical = business.available ? business : funnelTotal;
  const difference =
    business.available && funnelTotal.available
      ? available(subtract(business.value, funnelTotal.value))
      : unavailable<ExactDecimal>("INPUT_UNAVAILABLE");

  let status: AdSpendReconciliationStatus = "incomplete";
  if (business.available && funnelTotal.available) {
    status = compare(business.value, funnelTotal.value) === 0 ? "matched" : "mismatch";
  } else if (business.available) {
    status = "business_only";
  } else if (funnelTotal.available) {
    status = "funnel_only";
  }

  return {
    canonicalAdSpend: canonical.available
      ? available(decimalToString(canonical.value))
      : unavailable("INPUT_UNAVAILABLE"),
    businessAdSpend: business.available
      ? available(decimalToString(business.value))
      : unavailable("INPUT_UNAVAILABLE"),
    funnelAdSpendTotal: funnelTotal.available
      ? available(decimalToString(funnelTotal.value))
      : unavailable("INPUT_UNAVAILABLE"),
    difference: difference.available
      ? available(decimalToString(difference.value))
      : unavailable("INPUT_UNAVAILABLE"),
    status,
  };
}
