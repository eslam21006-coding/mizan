import type { ExactRatio } from "./calculations.ts";
import {
  FunnelReverseEngineeringInputError,
  reverseEngineerFunnel,
} from "./funnel-reverse-engineering.ts";
import {
  calculateSustainableAcquisitionEconomics,
  SustainableAcquisitionInputError,
  type SustainableAcquisitionMetric,
  type SustainableAcquisitionMetricUnavailableReason,
} from "./sustainable-acquisition.ts";

export const TARGET_GOAL_TYPES = ["revenue", "net_profit", "net_profit_margin"] as const;

export type TargetGoalType = (typeof TARGET_GOAL_TYPES)[number];

export type TargetGoal =
  | { type: "revenue"; amount: string }
  | { type: "net_profit"; amount: string }
  | { type: "net_profit_margin"; margin: ExactRatio };

export type TargetAssumptionSource =
  | { kind: "manual" }
  | { kind: "rolling_3_months"; months: readonly [string, string, string] };

export type TargetPlannerAssumptions = {
  source: TargetAssumptionSource;
  revenuePerNewCustomer: ExactRatio;
  monthlyFixedAcquisitionCosts: ExactRatio;
  monthlyFixedNonAcquisitionCosts: ExactRatio;
  variableNonMediaAcquisitionCostPerNewCustomer: ExactRatio;
  variableNonAcquisitionCostPerNewCustomer: ExactRatio;
  assumedMediaCac: ExactRatio;
  bookingRate: ExactRatio;
  showRate: ExactRatio;
  qualificationRate: ExactRatio;
  closeRate: ExactRatio;
  saleToNewCustomerRate: ExactRatio;
};

export type TargetMetricUnavailableReason = SustainableAcquisitionMetricUnavailableReason;
export type TargetMetric<T> = SustainableAcquisitionMetric<T>;

export type TargetPlanUnattainableReason =
  | "NON_POSITIVE_UNIT_PROFIT"
  | "MARGIN_TARGET_UNATTAINABLE";

export type TargetProfitConstraint =
  | { kind: "break_even"; amount: ExactRatio }
  | { kind: "target_net_profit"; amount: ExactRatio }
  | { kind: "target_margin"; amount: ExactRatio };

export type TargetPlanReady = {
  status: "ready";
  goal: TargetGoal;
  assumptions: TargetPlannerAssumptions;
  profitConstraint: TargetProfitConstraint;
  requiredRevenue: ExactRatio;
  requiredCustomers: number;
  requiredSales: number;
  requiredQualifiedCalls: number;
  requiredShows: number;
  requiredBookings: number;
  requiredLeads: number;
  requiredAdSpend: ExactRatio;
  maximumSustainableAcquisitionCac: TargetMetric<ExactRatio>;
  maximumMediaCac: TargetMetric<ExactRatio>;
  maximumCpl: TargetMetric<ExactRatio>;
  projectedNetProfit: ExactRatio;
  projectedMargin: ExactRatio;
};

export type TargetPlanUnattainable = {
  status: "unattainable";
  reason: TargetPlanUnattainableReason;
  goal: TargetGoal;
  assumptions: TargetPlannerAssumptions;
};

export type TargetPlanResult = TargetPlanReady | TargetPlanUnattainable;

export type Rolling3TargetActualMonth = {
  month: string;
  netCashCollected: string | null;
  newCustomers: number | null;
  adSpend: string | null;
  fixedAcquisitionCosts: string | null;
  fixedNonAcquisitionCosts: string | null;
  variableNonMediaAcquisitionCosts: string | null;
  variableNonAcquisitionCosts: string | null;
  leads: number | null;
  bookedCalls: number | null;
  showedCalls: number | null;
  qualifiedCalls: number | null;
  sales: number | null;
};

export type Rolling3AssumptionBlockerCode =
  | "MISSING_ACTUAL"
  | "NON_POSITIVE_NET_CASH"
  | "NO_NEW_CUSTOMERS"
  | "NO_LEADS"
  | "NO_BOOKED_CALLS"
  | "NO_SHOWED_CALLS"
  | "NO_QUALIFIED_CALLS"
  | "NO_SALES"
  | "INCONSISTENT_FUNNEL_SEQUENCE";

export type Rolling3AssumptionBlocker = {
  code: Rolling3AssumptionBlockerCode;
  field?: keyof Omit<Rolling3TargetActualMonth, "month">;
  month?: string;
};

export type Rolling3TargetAssumptionResult =
  | { status: "ready"; assumptions: TargetPlannerAssumptions }
  | { status: "insufficient"; blockers: readonly Rolling3AssumptionBlocker[] };

type Rational = {
  numerator: bigint;
  denominator: bigint;
};

type ActualDecimalField =
  | "netCashCollected"
  | "adSpend"
  | "fixedAcquisitionCosts"
  | "fixedNonAcquisitionCosts"
  | "variableNonMediaAcquisitionCosts"
  | "variableNonAcquisitionCosts";

type ActualCountField =
  | "newCustomers"
  | "leads"
  | "bookedCalls"
  | "showedCalls"
  | "qualifiedCalls"
  | "sales";

const INTEGER_PATTERN = /^-?\d+$/;
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ZERO: Rational = { numerator: 0n, denominator: 1n };
const ONE: Rational = { numerator: 1n, denominator: 1n };

export class TargetEngineInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TargetEngineInputError";
  }
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

function normalize(value: Rational): Rational {
  if (value.denominator === 0n) {
    throw new TargetEngineInputError("Exact ratio denominator cannot be zero.");
  }
  if (value.numerator === 0n) return ZERO;

  const sign = value.denominator < 0n ? -1n : 1n;
  const numerator = value.numerator * sign;
  const denominator = value.denominator * sign;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

function fromExactRatio(value: ExactRatio, fieldName: string): Rational {
  if (!INTEGER_PATTERN.test(value.numerator) || !INTEGER_PATTERN.test(value.denominator)) {
    throw new TargetEngineInputError(`${fieldName} must contain canonical integer ratio parts.`);
  }
  return normalize({
    numerator: BigInt(value.numerator),
    denominator: BigInt(value.denominator),
  });
}

function fromDecimal(value: string, fieldName: string, allowNegative = false): Rational {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new TargetEngineInputError(`${fieldName} must be a canonical decimal string.`);
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const numerator = BigInt(`${whole}${fraction}` || "0") * (negative ? -1n : 1n);
  const denominator = 10n ** BigInt(fraction.length);
  const parsed = normalize({ numerator, denominator });

  if (!allowNegative && parsed.numerator < 0n) {
    throw new TargetEngineInputError(`${fieldName} cannot be negative.`);
  }
  return parsed;
}

function toExactRatio(value: Rational): ExactRatio {
  const normalized = normalize(value);
  return {
    numerator: normalized.numerator.toString(),
    denominator: normalized.denominator.toString(),
  };
}

function add(left: Rational, right: Rational): Rational {
  return normalize({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

function subtract(left: Rational, right: Rational): Rational {
  return normalize({
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

function multiply(left: Rational, right: Rational): Rational {
  return normalize({
    numerator: left.numerator * right.numerator,
    denominator: left.denominator * right.denominator,
  });
}

function divide(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) {
    throw new TargetEngineInputError("Cannot divide by zero in target planning.");
  }
  return normalize({
    numerator: left.numerator * right.denominator,
    denominator: left.denominator * right.numerator,
  });
}

function multiplyCount(value: Rational, count: number): Rational {
  return multiply(value, { numerator: BigInt(count), denominator: 1n });
}

function compare(left: Rational, right: Rational) {
  const scaledLeft = left.numerator * right.denominator;
  const scaledRight = right.numerator * left.denominator;
  return scaledLeft === scaledRight ? 0 : scaledLeft > scaledRight ? 1 : -1;
}

function ceilPositive(value: Rational, fieldName: string): number {
  const normalized = normalize(value);
  if (normalized.numerator < 0n) {
    throw new TargetEngineInputError(`${fieldName} cannot require a negative count.`);
  }
  const quotient = normalized.numerator / normalized.denominator;
  const remainder = normalized.numerator % normalized.denominator;
  const result = quotient + (remainder === 0n ? 0n : 1n);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new TargetEngineInputError(`${fieldName} exceeds the safe integer planning boundary.`);
  }
  return Number(result);
}

function requireNonNegativeRatio(value: ExactRatio, fieldName: string) {
  const parsed = fromExactRatio(value, fieldName);
  if (parsed.numerator < 0n) {
    throw new TargetEngineInputError(`${fieldName} cannot be negative.`);
  }
  return parsed;
}

function requirePositiveRatio(value: ExactRatio, fieldName: string) {
  const parsed = requireNonNegativeRatio(value, fieldName);
  if (parsed.numerator === 0n) {
    throw new TargetEngineInputError(`${fieldName} must be greater than zero.`);
  }
  return parsed;
}

function requireRate(value: ExactRatio, fieldName: string) {
  const parsed = requirePositiveRatio(value, fieldName);
  if (compare(parsed, ONE) > 0) {
    throw new TargetEngineInputError(`${fieldName} cannot exceed 100%.`);
  }
  return parsed;
}

function validateAssumptions(assumptions: TargetPlannerAssumptions) {
  const values = {
    revenuePerNewCustomer: requirePositiveRatio(
      assumptions.revenuePerNewCustomer,
      "revenuePerNewCustomer",
    ),
    monthlyFixedAcquisitionCosts: requireNonNegativeRatio(
      assumptions.monthlyFixedAcquisitionCosts,
      "monthlyFixedAcquisitionCosts",
    ),
    monthlyFixedNonAcquisitionCosts: requireNonNegativeRatio(
      assumptions.monthlyFixedNonAcquisitionCosts,
      "monthlyFixedNonAcquisitionCosts",
    ),
    variableNonMediaAcquisitionCostPerNewCustomer: requireNonNegativeRatio(
      assumptions.variableNonMediaAcquisitionCostPerNewCustomer,
      "variableNonMediaAcquisitionCostPerNewCustomer",
    ),
    variableNonAcquisitionCostPerNewCustomer: requireNonNegativeRatio(
      assumptions.variableNonAcquisitionCostPerNewCustomer,
      "variableNonAcquisitionCostPerNewCustomer",
    ),
    assumedMediaCac: requireNonNegativeRatio(assumptions.assumedMediaCac, "assumedMediaCac"),
  };

  requireRate(assumptions.bookingRate, "bookingRate");
  requireRate(assumptions.showRate, "showRate");
  requireRate(assumptions.qualificationRate, "qualificationRate");
  requireRate(assumptions.closeRate, "closeRate");
  requireRate(assumptions.saleToNewCustomerRate, "saleToNewCustomerRate");
  return values;
}

function resolveRequiredCustomers(
  goal: TargetGoal,
  values: ReturnType<typeof validateAssumptions>,
): number | TargetPlanUnattainableReason {
  const fixedTotal = add(values.monthlyFixedAcquisitionCosts, values.monthlyFixedNonAcquisitionCosts);
  const variableCostPerCustomer = add(
    add(
      values.variableNonMediaAcquisitionCostPerNewCustomer,
      values.variableNonAcquisitionCostPerNewCustomer,
    ),
    values.assumedMediaCac,
  );
  const unitProfitBeforeFixed = subtract(values.revenuePerNewCustomer, variableCostPerCustomer);

  if (goal.type === "revenue") {
    const targetRevenue = fromDecimal(goal.amount, "target revenue");
    if (targetRevenue.numerator === 0n) {
      throw new TargetEngineInputError("Revenue target must be greater than zero.");
    }
    return Math.max(
      1,
      ceilPositive(divide(targetRevenue, values.revenuePerNewCustomer), "requiredCustomers"),
    );
  }

  if (goal.type === "net_profit") {
    const targetProfit = fromDecimal(goal.amount, "target net profit");
    const requiredContribution = add(targetProfit, fixedTotal);
    const unitProfitComparison = compare(unitProfitBeforeFixed, ZERO);
    if (unitProfitComparison < 0) return "NON_POSITIVE_UNIT_PROFIT";
    if (unitProfitComparison === 0) {
      return requiredContribution.numerator === 0n ? 1 : "NON_POSITIVE_UNIT_PROFIT";
    }
    return Math.max(
      1,
      ceilPositive(divide(requiredContribution, unitProfitBeforeFixed), "requiredCustomers"),
    );
  }

  const targetMargin = fromExactRatio(goal.margin, "target net profit margin");
  if (targetMargin.numerator < 0n || compare(targetMargin, ONE) > 0) {
    throw new TargetEngineInputError("Target net profit margin must be between 0% and 100%.");
  }

  const targetProfitPerCustomer = multiply(values.revenuePerNewCustomer, targetMargin);
  const marginHeadroomPerCustomer = subtract(unitProfitBeforeFixed, targetProfitPerCustomer);
  if (compare(marginHeadroomPerCustomer, ZERO) < 0) return "MARGIN_TARGET_UNATTAINABLE";
  if (compare(marginHeadroomPerCustomer, ZERO) === 0) {
    return fixedTotal.numerator === 0n ? 1 : "MARGIN_TARGET_UNATTAINABLE";
  }
  return Math.max(
    1,
    ceilPositive(divide(fixedTotal, marginHeadroomPerCustomer), "requiredCustomers"),
  );
}

/**
 * Reverse-engineers a monthly operating plan from one explicit target and one explicit assumption set.
 * Task 30 owns the funnel-volume path; Task 31 owns sustainable Acquisition CAC / Media CAC / CPL.
 */
export function planTarget(goal: TargetGoal, assumptions: TargetPlannerAssumptions): TargetPlanResult {
  const values = validateAssumptions(assumptions);
  const requiredCustomersResult = resolveRequiredCustomers(goal, values);
  if (typeof requiredCustomersResult === "string") {
    return {
      status: "unattainable",
      reason: requiredCustomersResult,
      goal,
      assumptions,
    };
  }

  const requiredCustomers = requiredCustomersResult;
  let funnelPlan: ReturnType<typeof reverseEngineerFunnel>;
  try {
    funnelPlan = reverseEngineerFunnel({
      requiredCustomers,
      bookingRate: assumptions.bookingRate,
      showRate: assumptions.showRate,
      qualificationRate: assumptions.qualificationRate,
      closeRate: assumptions.closeRate,
      saleToNewCustomerRate: assumptions.saleToNewCustomerRate,
    });
  } catch (error) {
    if (error instanceof FunnelReverseEngineeringInputError) {
      throw new TargetEngineInputError(error.message);
    }
    throw error;
  }

  const requiredRevenue = multiplyCount(values.revenuePerNewCustomer, requiredCustomers);
  const requiredAdSpend = multiplyCount(values.assumedMediaCac, requiredCustomers);
  const variableNonMediaAcquisitionCosts = multiplyCount(
    values.variableNonMediaAcquisitionCostPerNewCustomer,
    requiredCustomers,
  );
  const variableNonAcquisitionCosts = multiplyCount(
    values.variableNonAcquisitionCostPerNewCustomer,
    requiredCustomers,
  );
  const totalProjectedCosts = add(
    add(values.monthlyFixedAcquisitionCosts, values.monthlyFixedNonAcquisitionCosts),
    add(add(variableNonMediaAcquisitionCosts, variableNonAcquisitionCosts), requiredAdSpend),
  );
  const projectedNetProfit = subtract(requiredRevenue, totalProjectedCosts);
  const projectedMargin = divide(projectedNetProfit, requiredRevenue);

  const profitConstraint: TargetProfitConstraint = (() => {
    if (goal.type === "revenue") {
      return { kind: "break_even", amount: toExactRatio(ZERO) };
    }
    if (goal.type === "net_profit") {
      return {
        kind: "target_net_profit",
        amount: toExactRatio(fromDecimal(goal.amount, "target net profit")),
      };
    }
    return {
      kind: "target_margin",
      amount: toExactRatio(
        multiply(requiredRevenue, fromExactRatio(goal.margin, "target net profit margin")),
      ),
    };
  })();

  let sustainableEconomics: ReturnType<typeof calculateSustainableAcquisitionEconomics>;
  try {
    sustainableEconomics = calculateSustainableAcquisitionEconomics({
      requiredRevenue: toExactRatio(requiredRevenue),
      requiredCustomers,
      requiredLeads: funnelPlan.requiredLeads,
      profitConstraintAmount: profitConstraint.amount,
      monthlyFixedAcquisitionCosts: assumptions.monthlyFixedAcquisitionCosts,
      monthlyFixedNonAcquisitionCosts: assumptions.monthlyFixedNonAcquisitionCosts,
      variableNonMediaAcquisitionCostPerNewCustomer:
        assumptions.variableNonMediaAcquisitionCostPerNewCustomer,
      variableNonAcquisitionCostPerNewCustomer:
        assumptions.variableNonAcquisitionCostPerNewCustomer,
    });
  } catch (error) {
    if (error instanceof SustainableAcquisitionInputError) {
      throw new TargetEngineInputError(error.message);
    }
    throw error;
  }

  return {
    status: "ready",
    goal,
    assumptions,
    profitConstraint,
    requiredRevenue: toExactRatio(requiredRevenue),
    requiredCustomers,
    requiredSales: funnelPlan.requiredSales,
    requiredQualifiedCalls: funnelPlan.requiredQualifiedCalls,
    requiredShows: funnelPlan.requiredShows,
    requiredBookings: funnelPlan.requiredBookings,
    requiredLeads: funnelPlan.requiredLeads,
    requiredAdSpend: toExactRatio(requiredAdSpend),
    maximumSustainableAcquisitionCac:
      sustainableEconomics.maximumSustainableAcquisitionCac,
    maximumMediaCac: sustainableEconomics.maximumMediaCac,
    maximumCpl: sustainableEconomics.maximumCpl,
    projectedNetProfit: toExactRatio(projectedNetProfit),
    projectedMargin: toExactRatio(projectedMargin),
  };
}

function monthIndex(month: string) {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new TargetEngineInputError(`Invalid month key: ${month}`);
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (!Number.isSafeInteger(year) || year < 2000) {
    throw new TargetEngineInputError(`Month is outside the supported planning range: ${month}`);
  }
  return year * 12 + monthNumber - 1;
}

function validateActualCount(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TargetEngineInputError(`${fieldName} must be a non-negative safe integer.`);
  }
  return value;
}

function blockerForMissingActual(
  month: Rolling3TargetActualMonth,
  field: keyof Omit<Rolling3TargetActualMonth, "month">,
): Rolling3AssumptionBlocker {
  return { code: "MISSING_ACTUAL", field, month: month.month };
}

function collectActualDecimal(
  months: readonly Rolling3TargetActualMonth[],
  field: ActualDecimalField,
  blockers: Rolling3AssumptionBlocker[],
  allowNegative = false,
) {
  let total = ZERO;
  for (const month of months) {
    const value = month[field];
    if (value === null) {
      blockers.push(blockerForMissingActual(month, field));
      continue;
    }
    total = add(total, fromDecimal(value, `${month.month}.${field}`, allowNegative));
  }
  return total;
}

function collectActualCount(
  months: readonly Rolling3TargetActualMonth[],
  field: ActualCountField,
  blockers: Rolling3AssumptionBlocker[],
) {
  let total = 0;
  for (const month of months) {
    const value = month[field];
    if (value === null) {
      blockers.push(blockerForMissingActual(month, field));
      continue;
    }
    const validated = validateActualCount(value, `${month.month}.${field}`);
    if (total > Number.MAX_SAFE_INTEGER - validated) {
      throw new TargetEngineInputError(`${field} exceeds the safe integer aggregation boundary.`);
    }
    total += validated;
  }
  return total;
}

/**
 * Builds Task 29's default monthly assumptions from the three consecutive months ending at lastCompleteMonth.
 * Ratios use aggregated numerators/denominators; fixed costs use the exact three-month monthly average.
 */
export function resolveRolling3TargetAssumptions(
  actualMonths: readonly Rolling3TargetActualMonth[],
  lastCompleteMonth: string,
): Rolling3TargetAssumptionResult {
  if (actualMonths.length !== 3) {
    throw new TargetEngineInputError("Rolling 3 Month assumptions require exactly three months.");
  }

  const lastCompleteMonthIndex = monthIndex(lastCompleteMonth);
  const months = [...actualMonths].sort(
    (left, right) => monthIndex(left.month) - monthIndex(right.month),
  );
  const indexes = months.map((month) => monthIndex(month.month));
  if (indexes[1] !== indexes[0] + 1 || indexes[2] !== indexes[1] + 1) {
    throw new TargetEngineInputError("Rolling 3 Month assumptions require consecutive calendar months.");
  }
  if (indexes.some((index) => index > lastCompleteMonthIndex)) {
    throw new TargetEngineInputError(
      "Rolling 3 Month assumptions cannot include an incomplete or future month.",
    );
  }
  if (indexes[2] !== lastCompleteMonthIndex) {
    throw new TargetEngineInputError(
      "Rolling 3 Month assumptions must end at the last complete month.",
    );
  }

  const blockers: Rolling3AssumptionBlocker[] = [];
  const netCashCollected = collectActualDecimal(months, "netCashCollected", blockers, true);
  const adSpend = collectActualDecimal(months, "adSpend", blockers);
  const fixedAcquisitionCosts = collectActualDecimal(months, "fixedAcquisitionCosts", blockers);
  const fixedNonAcquisitionCosts = collectActualDecimal(
    months,
    "fixedNonAcquisitionCosts",
    blockers,
  );
  const variableNonMediaAcquisitionCosts = collectActualDecimal(
    months,
    "variableNonMediaAcquisitionCosts",
    blockers,
  );
  const variableNonAcquisitionCosts = collectActualDecimal(
    months,
    "variableNonAcquisitionCosts",
    blockers,
  );

  const newCustomers = collectActualCount(months, "newCustomers", blockers);
  const leads = collectActualCount(months, "leads", blockers);
  const bookedCalls = collectActualCount(months, "bookedCalls", blockers);
  const showedCalls = collectActualCount(months, "showedCalls", blockers);
  const qualifiedCalls = collectActualCount(months, "qualifiedCalls", blockers);
  const sales = collectActualCount(months, "sales", blockers);

  if (blockers.length > 0) return { status: "insufficient", blockers };
  if (compare(netCashCollected, ZERO) <= 0) blockers.push({ code: "NON_POSITIVE_NET_CASH" });
  if (newCustomers === 0) blockers.push({ code: "NO_NEW_CUSTOMERS" });
  if (leads === 0) blockers.push({ code: "NO_LEADS" });
  if (bookedCalls === 0) blockers.push({ code: "NO_BOOKED_CALLS" });
  if (showedCalls === 0) blockers.push({ code: "NO_SHOWED_CALLS" });
  if (qualifiedCalls === 0) blockers.push({ code: "NO_QUALIFIED_CALLS" });
  if (sales === 0) blockers.push({ code: "NO_SALES" });

  if (
    bookedCalls > leads ||
    showedCalls > bookedCalls ||
    qualifiedCalls > showedCalls ||
    sales > qualifiedCalls ||
    newCustomers > sales
  ) {
    blockers.push({ code: "INCONSISTENT_FUNNEL_SEQUENCE" });
  }

  if (blockers.length > 0) return { status: "insufficient", blockers };

  const newCustomerDenominator = { numerator: BigInt(newCustomers), denominator: 1n };
  const threeMonths = { numerator: 3n, denominator: 1n };

  return {
    status: "ready",
    assumptions: {
      source: {
        kind: "rolling_3_months",
        months: [months[0].month, months[1].month, months[2].month],
      },
      revenuePerNewCustomer: toExactRatio(divide(netCashCollected, newCustomerDenominator)),
      monthlyFixedAcquisitionCosts: toExactRatio(divide(fixedAcquisitionCosts, threeMonths)),
      monthlyFixedNonAcquisitionCosts: toExactRatio(
        divide(fixedNonAcquisitionCosts, threeMonths),
      ),
      variableNonMediaAcquisitionCostPerNewCustomer: toExactRatio(
        divide(variableNonMediaAcquisitionCosts, newCustomerDenominator),
      ),
      variableNonAcquisitionCostPerNewCustomer: toExactRatio(
        divide(variableNonAcquisitionCosts, newCustomerDenominator),
      ),
      assumedMediaCac: toExactRatio(divide(adSpend, newCustomerDenominator)),
      bookingRate: toExactRatio({
        numerator: BigInt(bookedCalls),
        denominator: BigInt(leads),
      }),
      showRate: toExactRatio({
        numerator: BigInt(showedCalls),
        denominator: BigInt(bookedCalls),
      }),
      qualificationRate: toExactRatio({
        numerator: BigInt(qualifiedCalls),
        denominator: BigInt(showedCalls),
      }),
      closeRate: toExactRatio({
        numerator: BigInt(sales),
        denominator: BigInt(qualifiedCalls),
      }),
      saleToNewCustomerRate: toExactRatio({
        numerator: BigInt(newCustomers),
        denominator: BigInt(sales),
      }),
    },
  };
}
