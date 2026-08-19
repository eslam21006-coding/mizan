export const CALCULATION_EXPENSE_CATEGORIES = [
  "acquisition",
  "fulfillment",
  "overhead",
  "financial",
] as const;

export type CalculationExpenseCategory = (typeof CALCULATION_EXPENSE_CATEGORIES)[number];

export const CALCULATION_EXPENSE_BEHAVIORS = [
  "fixed_monthly",
  "per_customer",
  "percentage_revenue",
] as const;

export type CalculationExpenseBehavior = (typeof CALCULATION_EXPENSE_BEHAVIORS)[number];
export type CalculationCustomerCountBasis = "new_customers" | "total_paying_customers";

export type CalculationUnavailableReason =
  | "INPUT_UNAVAILABLE"
  | "NO_NEW_CUSTOMERS"
  | "NO_PAYING_CUSTOMERS"
  | "NON_POSITIVE_NET_CASH"
  | "NO_AD_SPEND"
  | "ATTRIBUTION_UNAVAILABLE";

export type CalculatedMetric<T> =
  | { available: true; value: T }
  | { available: false; reason: CalculationUnavailableReason };

export type ExactRatio = {
  numerator: string;
  denominator: string;
};

export type MonthlyRevenueCalculationInput = {
  id: string;
  name: string;
  streamType: string;
  grossCashCollected: string | null;
  refunds: string | null;
};

export type MonthlyExpenseCalculationInput = {
  id: string;
  name: string;
  category: CalculationExpenseCategory;
  behavior: CalculationExpenseBehavior;
  inputValue: string | null;
  customerCountBasis?: CalculationCustomerCountBasis | null;
};

export type CoreCalculationInput = {
  revenueStreams: readonly MonthlyRevenueCalculationInput[];
  expenses: readonly MonthlyExpenseCalculationInput[];
  unallocatedGrossCashCollected: string | null;
  unallocatedRefunds: string | null;
  newCustomers: number | null;
  totalPayingCustomers: number | null;
  canonicalAdSpend?: string | null;
  attributedRevenue?: string | null;
};

export type RevenueStreamCalculation = {
  id: string;
  name: string;
  streamType: string;
  grossCashCollected: CalculatedMetric<string>;
  refunds: CalculatedMetric<string>;
  netCashCollected: CalculatedMetric<string>;
};

export type ExpenseItemCalculation = {
  id: string;
  name: string;
  category: CalculationExpenseCategory;
  behavior: CalculationExpenseBehavior;
  amount: CalculatedMetric<string>;
  variable: boolean;
};

export type CoreCalculationResult = {
  revenueByStream: RevenueStreamCalculation[];
  grossCashCollected: CalculatedMetric<string>;
  refunds: CalculatedMetric<string>;
  netCashCollected: CalculatedMetric<string>;
  newCustomers: CalculatedMetric<number>;
  totalPayingCustomers: CalculatedMetric<number>;
  returningCustomers: CalculatedMetric<number>;
  expensesByItem: ExpenseItemCalculation[];
  expensesByCategory: Record<CalculationExpenseCategory, CalculatedMetric<string>>;
  allBusinessCosts: CalculatedMetric<string>;
  variableCosts: CalculatedMetric<string>;
  realNetProfit: CalculatedMetric<string>;
  realNetProfitMargin: CalculatedMetric<ExactRatio>;
  contributionProfit: CalculatedMetric<string>;
  contributionMargin: CalculatedMetric<ExactRatio>;
  mediaCac: CalculatedMetric<ExactRatio>;
  acquisitionCac: CalculatedMetric<ExactRatio>;
  ultimateCac: CalculatedMetric<ExactRatio>;
  revenuePerPayingCustomer: CalculatedMetric<ExactRatio>;
  revenuePerNewCustomer: CalculatedMetric<ExactRatio>;
  mer: CalculatedMetric<ExactRatio>;
  roas: CalculatedMetric<ExactRatio>;
};

type ExactDecimal = {
  coefficient: bigint;
  scale: number;
};

const ZERO_DECIMAL: ExactDecimal = { coefficient: 0n, scale: 0 };
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

export class CalculationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculationInputError";
  }
}

function available<T>(value: T): CalculatedMetric<T> {
  return { available: true, value };
}

function unavailable<T>(reason: CalculationUnavailableReason): CalculatedMetric<T> {
  return { available: false, reason };
}

function powerOfTen(exponent: number) {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new CalculationInputError("Decimal scale must be a non-negative integer.");
  }
  return 10n ** BigInt(exponent);
}

function normalizeDecimal(decimal: ExactDecimal): ExactDecimal {
  if (decimal.coefficient === 0n) return ZERO_DECIMAL;

  let coefficient = decimal.coefficient;
  let scale = decimal.scale;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

function parseDecimal(value: string, fieldName: string, allowNegative = false): ExactDecimal {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new CalculationInputError(`${fieldName} must be a canonical decimal string.`);
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const coefficient = BigInt(`${whole}${fraction}` || "0") * (negative ? -1n : 1n);
  const parsed = normalizeDecimal({ coefficient, scale: fraction.length });

  if (!allowNegative && parsed.coefficient < 0n) {
    throw new CalculationInputError(`${fieldName} cannot be negative.`);
  }

  return parsed;
}

function decimalToString(decimal: ExactDecimal) {
  const normalized = normalizeDecimal(decimal);
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

function addDecimals(left: ExactDecimal, right: ExactDecimal) {
  const aligned = alignScales(left, right);
  return normalizeDecimal({ coefficient: aligned.left + aligned.right, scale: aligned.scale });
}

function subtractDecimals(left: ExactDecimal, right: ExactDecimal) {
  const aligned = alignScales(left, right);
  return normalizeDecimal({ coefficient: aligned.left - aligned.right, scale: aligned.scale });
}

function multiplyDecimals(left: ExactDecimal, right: ExactDecimal) {
  return normalizeDecimal({
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  });
}

function compareDecimals(left: ExactDecimal, right: ExactDecimal) {
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
    throw new CalculationInputError("Cannot construct an exact ratio with a zero denominator.");
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

function decimalMetric(value: string | null, fieldName: string): CalculatedMetric<ExactDecimal> {
  return value === null ? unavailable("INPUT_UNAVAILABLE") : available(parseDecimal(value, fieldName));
}

function countMetric(value: number | null, fieldName: string): CalculatedMetric<number> {
  if (value === null) return unavailable("INPUT_UNAVAILABLE");
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CalculationInputError(`${fieldName} must be a non-negative safe integer.`);
  }
  return available(value);
}

function sumDecimalMetrics(metrics: readonly CalculatedMetric<ExactDecimal>[]) {
  if (metrics.some((metric) => !metric.available)) return unavailable<ExactDecimal>("INPUT_UNAVAILABLE");
  return available(
    metrics.reduce(
      (total, metric) => addDecimals(total, (metric as { available: true; value: ExactDecimal }).value),
      ZERO_DECIMAL,
    ),
  );
}

function asStringMetric(metric: CalculatedMetric<ExactDecimal>): CalculatedMetric<string> {
  return metric.available ? available(decimalToString(metric.value)) : metric;
}

function subtractMetrics(
  left: CalculatedMetric<ExactDecimal>,
  right: CalculatedMetric<ExactDecimal>,
): CalculatedMetric<ExactDecimal> {
  if (!left.available || !right.available) return unavailable("INPUT_UNAVAILABLE");
  return available(subtractDecimals(left.value, right.value));
}

function ratioWithPositiveDenominator(
  numerator: CalculatedMetric<ExactDecimal>,
  denominator: CalculatedMetric<ExactDecimal>,
  zeroReason: CalculationUnavailableReason,
): CalculatedMetric<ExactRatio> {
  if (!denominator.available) return unavailable("INPUT_UNAVAILABLE");
  if (compareDecimals(denominator.value, ZERO_DECIMAL) <= 0) return unavailable(zeroReason);
  if (!numerator.available) return unavailable("INPUT_UNAVAILABLE");
  return available(exactRatio(numerator.value, denominator.value));
}

function ratioByCount(
  numerator: CalculatedMetric<ExactDecimal>,
  count: CalculatedMetric<number>,
  zeroReason: "NO_NEW_CUSTOMERS" | "NO_PAYING_CUSTOMERS",
): CalculatedMetric<ExactRatio> {
  if (!count.available) return unavailable("INPUT_UNAVAILABLE");
  if (count.value === 0) return unavailable(zeroReason);
  if (!numerator.available) return unavailable("INPUT_UNAVAILABLE");
  return available(exactRatio(numerator.value, { coefficient: BigInt(count.value), scale: 0 }));
}

function calculateReturningCustomers(
  newCustomers: CalculatedMetric<number>,
  totalPayingCustomers: CalculatedMetric<number>,
): CalculatedMetric<number> {
  if (!newCustomers.available || !totalPayingCustomers.available) return unavailable("INPUT_UNAVAILABLE");
  if (newCustomers.value > totalPayingCustomers.value) {
    throw new CalculationInputError("newCustomers cannot exceed totalPayingCustomers.");
  }
  return available(totalPayingCustomers.value - newCustomers.value);
}

function customerCountForExpense(
  basis: CalculationCustomerCountBasis | null | undefined,
  newCustomers: CalculatedMetric<number>,
  totalPayingCustomers: CalculatedMetric<number>,
) {
  if (basis === "new_customers") return newCustomers;
  if (basis === "total_paying_customers") return totalPayingCustomers;
  throw new CalculationInputError("Per-customer expense requires an explicit customer count basis.");
}

function calculateExpenseAmount(
  expense: MonthlyExpenseCalculationInput,
  netCash: CalculatedMetric<ExactDecimal>,
  newCustomers: CalculatedMetric<number>,
  totalPayingCustomers: CalculatedMetric<number>,
): CalculatedMetric<ExactDecimal> {
  if (expense.inputValue === null) return unavailable("INPUT_UNAVAILABLE");
  const inputValue = parseDecimal(expense.inputValue, `expense ${expense.id}`);

  if (expense.behavior === "fixed_monthly") {
    if (expense.customerCountBasis) {
      throw new CalculationInputError("Fixed monthly expense cannot have a customer count basis.");
    }
    return available(inputValue);
  }

  if (expense.behavior === "per_customer") {
    const count = customerCountForExpense(
      expense.customerCountBasis,
      newCustomers,
      totalPayingCustomers,
    );
    if (!count.available) return unavailable("INPUT_UNAVAILABLE");
    return available(multiplyDecimals(inputValue, { coefficient: BigInt(count.value), scale: 0 }));
  }

  if (expense.customerCountBasis) {
    throw new CalculationInputError("Percentage-of-revenue expense cannot have a customer count basis.");
  }
  if (!netCash.available) return unavailable("INPUT_UNAVAILABLE");

  const percentageBase = compareDecimals(netCash.value, ZERO_DECIMAL) > 0 ? netCash.value : ZERO_DECIMAL;
  return available(multiplyDecimals(inputValue, percentageBase));
}

function assertExpenseShape(expense: MonthlyExpenseCalculationInput) {
  if (!CALCULATION_EXPENSE_CATEGORIES.includes(expense.category)) {
    throw new CalculationInputError(`Unsupported expense category: ${expense.category}`);
  }
  if (!CALCULATION_EXPENSE_BEHAVIORS.includes(expense.behavior)) {
    throw new CalculationInputError(`Unsupported expense behavior: ${expense.behavior}`);
  }
}

export function calculateCoreFinancials(input: CoreCalculationInput): CoreCalculationResult {
  const newCustomers = countMetric(input.newCustomers, "newCustomers");
  const totalPayingCustomers = countMetric(input.totalPayingCustomers, "totalPayingCustomers");
  const returningCustomers = calculateReturningCustomers(newCustomers, totalPayingCustomers);

  const streamDecimals = input.revenueStreams.map((stream) => {
    const gross = decimalMetric(stream.grossCashCollected, `revenue stream ${stream.id} gross cash`);
    const refunds = decimalMetric(stream.refunds, `revenue stream ${stream.id} refunds`);
    return { stream, gross, refunds, net: subtractMetrics(gross, refunds) };
  });

  const unallocatedGross = decimalMetric(
    input.unallocatedGrossCashCollected,
    "unallocatedGrossCashCollected",
  );
  const unallocatedRefunds = decimalMetric(input.unallocatedRefunds, "unallocatedRefunds");

  const grossCashCollectedDecimal = sumDecimalMetrics([
    ...streamDecimals.map((entry) => entry.gross),
    unallocatedGross,
  ]);
  const refundsDecimal = sumDecimalMetrics([
    ...streamDecimals.map((entry) => entry.refunds),
    unallocatedRefunds,
  ]);
  const netCashDecimal = subtractMetrics(grossCashCollectedDecimal, refundsDecimal);

  const expenseDecimals = input.expenses.map((expense) => {
    assertExpenseShape(expense);
    return {
      expense,
      amount: calculateExpenseAmount(expense, netCashDecimal, newCustomers, totalPayingCustomers),
    };
  });

  const expensesByCategoryDecimal = Object.fromEntries(
    CALCULATION_EXPENSE_CATEGORIES.map((category) => [
      category,
      sumDecimalMetrics(
        expenseDecimals
          .filter((entry) => entry.expense.category === category)
          .map((entry) => entry.amount),
      ),
    ]),
  ) as Record<CalculationExpenseCategory, CalculatedMetric<ExactDecimal>>;

  const allBusinessCostsDecimal = sumDecimalMetrics(
    CALCULATION_EXPENSE_CATEGORIES.map((category) => expensesByCategoryDecimal[category]),
  );
  const variableCostsDecimal = sumDecimalMetrics(
    expenseDecimals
      .filter((entry) => entry.expense.behavior !== "fixed_monthly")
      .map((entry) => entry.amount),
  );
  const realNetProfitDecimal = subtractMetrics(netCashDecimal, allBusinessCostsDecimal);
  const contributionProfitDecimal = subtractMetrics(netCashDecimal, variableCostsDecimal);

  const canonicalAdSpendDecimal =
    input.canonicalAdSpend === undefined || input.canonicalAdSpend === null
      ? unavailable<ExactDecimal>("INPUT_UNAVAILABLE")
      : available(parseDecimal(input.canonicalAdSpend, "canonicalAdSpend"));
  const attributedRevenueDecimal =
    input.attributedRevenue === undefined || input.attributedRevenue === null
      ? unavailable<ExactDecimal>("ATTRIBUTION_UNAVAILABLE")
      : available(parseDecimal(input.attributedRevenue, "attributedRevenue", true));

  const acquisitionCostsDecimal = expensesByCategoryDecimal.acquisition;

  const roas = (() => {
    if (!attributedRevenueDecimal.available) return unavailable<ExactRatio>("ATTRIBUTION_UNAVAILABLE");
    if (!canonicalAdSpendDecimal.available) return unavailable<ExactRatio>("INPUT_UNAVAILABLE");
    if (compareDecimals(canonicalAdSpendDecimal.value, ZERO_DECIMAL) === 0) {
      return unavailable<ExactRatio>("NO_AD_SPEND");
    }
    return available(exactRatio(attributedRevenueDecimal.value, canonicalAdSpendDecimal.value));
  })();

  return {
    revenueByStream: streamDecimals.map(({ stream, gross, refunds, net }) => ({
      id: stream.id,
      name: stream.name,
      streamType: stream.streamType,
      grossCashCollected: asStringMetric(gross),
      refunds: asStringMetric(refunds),
      netCashCollected: asStringMetric(net),
    })),
    grossCashCollected: asStringMetric(grossCashCollectedDecimal),
    refunds: asStringMetric(refundsDecimal),
    netCashCollected: asStringMetric(netCashDecimal),
    newCustomers,
    totalPayingCustomers,
    returningCustomers,
    expensesByItem: expenseDecimals.map(({ expense, amount }) => ({
      id: expense.id,
      name: expense.name,
      category: expense.category,
      behavior: expense.behavior,
      amount: asStringMetric(amount),
      variable: expense.behavior !== "fixed_monthly",
    })),
    expensesByCategory: Object.fromEntries(
      CALCULATION_EXPENSE_CATEGORIES.map((category) => [
        category,
        asStringMetric(expensesByCategoryDecimal[category]),
      ]),
    ) as Record<CalculationExpenseCategory, CalculatedMetric<string>>,
    allBusinessCosts: asStringMetric(allBusinessCostsDecimal),
    variableCosts: asStringMetric(variableCostsDecimal),
    realNetProfit: asStringMetric(realNetProfitDecimal),
    realNetProfitMargin: ratioWithPositiveDenominator(
      realNetProfitDecimal,
      netCashDecimal,
      "NON_POSITIVE_NET_CASH",
    ),
    contributionProfit: asStringMetric(contributionProfitDecimal),
    contributionMargin: ratioWithPositiveDenominator(
      contributionProfitDecimal,
      netCashDecimal,
      "NON_POSITIVE_NET_CASH",
    ),
    mediaCac: ratioByCount(canonicalAdSpendDecimal, newCustomers, "NO_NEW_CUSTOMERS"),
    acquisitionCac: ratioByCount(acquisitionCostsDecimal, newCustomers, "NO_NEW_CUSTOMERS"),
    ultimateCac: ratioByCount(allBusinessCostsDecimal, newCustomers, "NO_NEW_CUSTOMERS"),
    revenuePerPayingCustomer: ratioByCount(
      netCashDecimal,
      totalPayingCustomers,
      "NO_PAYING_CUSTOMERS",
    ),
    revenuePerNewCustomer: ratioByCount(netCashDecimal, newCustomers, "NO_NEW_CUSTOMERS"),
    mer: ratioWithPositiveDenominator(netCashDecimal, canonicalAdSpendDecimal, "NO_AD_SPEND"),
    roas,
  };
}
