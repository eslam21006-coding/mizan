import {
  CALCULATION_EXPENSE_CATEGORIES,
  type CalculatedMetric,
  type CalculationExpenseCategory,
  type CoreCalculationResult,
  type ExactRatio,
} from "./calculations";

type ExactDecimal = {
  coefficient: bigint;
  scale: number;
};

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;
const ZERO: ExactDecimal = { coefficient: 0n, scale: 0 };

export type HistoricalAggregateResult = {
  grossCashCollected: CalculatedMetric<string>;
  refunds: CalculatedMetric<string>;
  netCashCollected: CalculatedMetric<string>;
  expensesByCategory: Record<CalculationExpenseCategory, CalculatedMetric<string>>;
  allBusinessCosts: CalculatedMetric<string>;
  variableCosts: CalculatedMetric<string>;
  realNetProfit: CalculatedMetric<string>;
  realNetProfitMargin: CalculatedMetric<ExactRatio>;
  contributionProfit: CalculatedMetric<string>;
  contributionMargin: CalculatedMetric<ExactRatio>;
  reportedNewCustomersSum: CalculatedMetric<number>;
  reportedPayingCustomersSum: CalculatedMetric<number>;
  exactUniqueCustomerMetricsAvailable: false;
};

function available<T>(value: T): CalculatedMetric<T> {
  return { available: true, value };
}

function unavailable<T>(): CalculatedMetric<T> {
  return { available: false, reason: "INPUT_UNAVAILABLE" };
}

function powerOfTen(exponent: number) {
  return 10n ** BigInt(exponent);
}

function normalize(value: ExactDecimal): ExactDecimal {
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
  if (!DECIMAL_PATTERN.test(raw)) throw new Error("Historical aggregate received an invalid decimal.");
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  return normalize({
    coefficient: BigInt(`${whole}${fraction}` || "0") * (negative ? -1n : 1n),
    scale: fraction.length,
  });
}

function add(left: ExactDecimal, right: ExactDecimal) {
  const scale = Math.max(left.scale, right.scale);
  return normalize({
    coefficient:
      left.coefficient * powerOfTen(scale - left.scale) +
      right.coefficient * powerOfTen(scale - right.scale),
    scale,
  });
}

function decimalToString(value: ExactDecimal) {
  const normalized = normalize(value);
  const negative = normalized.coefficient < 0n;
  const digits = (negative ? -normalized.coefficient : normalized.coefficient).toString();
  if (normalized.scale === 0) return `${negative ? "-" : ""}${digits}`;
  const padded = digits.padStart(normalized.scale + 1, "0");
  const splitAt = padded.length - normalized.scale;
  return `${negative ? "-" : ""}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
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

function sumDecimalMetrics(metrics: readonly CalculatedMetric<string>[]): CalculatedMetric<string> {
  if (metrics.some((metric) => !metric.available)) return unavailable();
  const total = metrics.reduce(
    (sum, metric) => add(sum, parseDecimal((metric as { available: true; value: string }).value)),
    ZERO,
  );
  return available(decimalToString(total));
}

function sumCountMetrics(metrics: readonly CalculatedMetric<number>[]): CalculatedMetric<number> {
  if (metrics.some((metric) => !metric.available)) return unavailable();
  const total = metrics.reduce(
    (sum, metric) => sum + (metric as { available: true; value: number }).value,
    0,
  );
  if (!Number.isSafeInteger(total)) return unavailable();
  return available(total);
}

function marginMetric(
  numerator: CalculatedMetric<string>,
  denominator: CalculatedMetric<string>,
): CalculatedMetric<ExactRatio> {
  if (!numerator.available || !denominator.available) return unavailable();
  const denominatorDecimal = parseDecimal(denominator.value);
  if (denominatorDecimal.coefficient <= 0n) {
    return { available: false, reason: "NON_POSITIVE_NET_CASH" };
  }
  return available(exactRatio(parseDecimal(numerator.value), denominatorDecimal));
}

export function aggregateHistoricalMonths(
  months: readonly CoreCalculationResult[],
): HistoricalAggregateResult {
  if (months.length === 0) throw new Error("Historical aggregation requires at least one month.");

  const grossCashCollected = sumDecimalMetrics(months.map((month) => month.grossCashCollected));
  const refunds = sumDecimalMetrics(months.map((month) => month.refunds));
  const netCashCollected = sumDecimalMetrics(months.map((month) => month.netCashCollected));
  const allBusinessCosts = sumDecimalMetrics(months.map((month) => month.allBusinessCosts));
  const variableCosts = sumDecimalMetrics(months.map((month) => month.variableCosts));
  const realNetProfit = sumDecimalMetrics(months.map((month) => month.realNetProfit));
  const contributionProfit = sumDecimalMetrics(months.map((month) => month.contributionProfit));

  const expensesByCategory = Object.fromEntries(
    CALCULATION_EXPENSE_CATEGORIES.map((category) => [
      category,
      sumDecimalMetrics(months.map((month) => month.expensesByCategory[category])),
    ]),
  ) as Record<CalculationExpenseCategory, CalculatedMetric<string>>;

  return {
    grossCashCollected,
    refunds,
    netCashCollected,
    expensesByCategory,
    allBusinessCosts,
    variableCosts,
    realNetProfit,
    realNetProfitMargin: marginMetric(realNetProfit, netCashCollected),
    contributionProfit,
    contributionMargin: marginMetric(contributionProfit, netCashCollected),
    reportedNewCustomersSum: sumCountMetrics(months.map((month) => month.newCustomers)),
    reportedPayingCustomersSum: sumCountMetrics(months.map((month) => month.totalPayingCustomers)),
    exactUniqueCustomerMetricsAvailable: false,
  };
}
