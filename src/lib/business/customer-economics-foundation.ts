import {
  absoluteRational,
  addRationals,
  compareRationals,
  normalizeRational,
  ONE_RATIONAL,
  rationalFromDecimalString,
  subtractRationals,
  type Rational,
  ZERO_RATIONAL,
} from "./exact-rational.ts";

export const CUSTOMER_ECONOMICS_PROVENANCE_STATES = [
  "direct_actual",
  "deterministic_estimate",
  "manual_override",
  "unallocated",
  "excluded",
] as const;

export type CustomerEconomicsProvenanceState =
  (typeof CUSTOMER_ECONOMICS_PROVENANCE_STATES)[number];

export const CUSTOMER_ECONOMICS_ELIGIBILITY_STATES = ["eligible", "excluded"] as const;
export type CustomerEconomicsEligibilityState =
  (typeof CUSTOMER_ECONOMICS_ELIGIBILITY_STATES)[number];

export const CUSTOMER_ECONOMICS_ALLOCATION_DRIVERS = [
  "new_customers",
  "paying_customers",
  "positive_collected_cash",
  "direct_link",
  "none",
] as const;

export type CustomerEconomicsAllocationDriver =
  (typeof CUSTOMER_ECONOMICS_ALLOCATION_DRIVERS)[number];

export type CustomerEconomicsExpenseCategory =
  | "acquisition"
  | "fulfillment"
  | "overhead"
  | "financial";

export type CustomerEconomicsExpenseBehavior =
  | "fixed_monthly"
  | "per_customer"
  | "percentage_revenue";

export type CustomerEconomicsCustomerBasis = "new_customers" | "total_paying_customers";

export type CustomerEconomicsCostRule = {
  eligibility: CustomerEconomicsEligibilityState;
  defaultDriver: CustomerEconomicsAllocationDriver;
  reason:
    | "ACQUISITION_COST"
    | "VARIABLE_CUSTOMER_COST"
    | "FIXED_FULFILLMENT"
    | "FIXED_OVERHEAD"
    | "FIXED_FINANCIAL"
    | "MISSING_CUSTOMER_BASIS";
};

export type AuthoritativeAmount =
  | { available: true; value: string }
  | { available: false; reason: "INPUT_UNAVAILABLE" };

export type CustomerEconomicsCostPoolFoundation = {
  authoritativeSourceType: "monthly_expense_entry";
  authoritativeSourceId: string;
  businessId: string;
  activityMonth: string;
  expenseItemId: string;
  expenseNameSnapshot: string;
  categorySnapshot: CustomerEconomicsExpenseCategory;
  behaviorSnapshot: CustomerEconomicsExpenseBehavior;
  customerBasisSnapshot: CustomerEconomicsCustomerBasis | null;
  authoritativeAmount: string | null;
  amountState: "actual" | "missing";
  eligibility: CustomerEconomicsEligibilityState;
  defaultDriver: CustomerEconomicsAllocationDriver;
  eligibilityReason: CustomerEconomicsCostRule["reason"];
};

export function classifyCustomerEconomicsCost(input: {
  category: CustomerEconomicsExpenseCategory;
  behavior: CustomerEconomicsExpenseBehavior;
  customerBasis?: CustomerEconomicsCustomerBasis | null;
}): CustomerEconomicsCostRule {
  if (input.category === "acquisition") {
    return {
      eligibility: "eligible",
      defaultDriver: "new_customers",
      reason: "ACQUISITION_COST",
    };
  }

  if (input.behavior === "fixed_monthly") {
    const reason =
      input.category === "fulfillment"
        ? "FIXED_FULFILLMENT"
        : input.category === "overhead"
          ? "FIXED_OVERHEAD"
          : "FIXED_FINANCIAL";
    return { eligibility: "excluded", defaultDriver: "none", reason };
  }

  if (input.behavior === "percentage_revenue") {
    return {
      eligibility: "eligible",
      defaultDriver: "positive_collected_cash",
      reason: "VARIABLE_CUSTOMER_COST",
    };
  }

  if (!input.customerBasis) {
    return {
      eligibility: "eligible",
      defaultDriver: "none",
      reason: "MISSING_CUSTOMER_BASIS",
    };
  }

  return {
    eligibility: "eligible",
    defaultDriver:
      input.customerBasis === "new_customers" ? "new_customers" : "paying_customers",
    reason: "VARIABLE_CUSTOMER_COST",
  };
}

export function buildCustomerEconomicsCostPoolFoundation(input: {
  authoritativeSourceId: string;
  businessId: string;
  activityMonth: string;
  expenseItemId: string;
  expenseNameSnapshot: string;
  categorySnapshot: CustomerEconomicsExpenseCategory;
  behaviorSnapshot: CustomerEconomicsExpenseBehavior;
  customerBasisSnapshot?: CustomerEconomicsCustomerBasis | null;
  authoritativeAmount: AuthoritativeAmount;
}): CustomerEconomicsCostPoolFoundation {
  const rule = classifyCustomerEconomicsCost({
    category: input.categorySnapshot,
    behavior: input.behaviorSnapshot,
    customerBasis: input.customerBasisSnapshot,
  });

  if (input.authoritativeAmount.available) {
    const parsed = rationalFromDecimalString(input.authoritativeAmount.value);
    if (compareRationals(parsed, ZERO_RATIONAL) < 0) {
      throw new Error("Authoritative expense amount cannot be negative.");
    }
  }

  return {
    authoritativeSourceType: "monthly_expense_entry",
    authoritativeSourceId: input.authoritativeSourceId,
    businessId: input.businessId,
    activityMonth: input.activityMonth,
    expenseItemId: input.expenseItemId,
    expenseNameSnapshot: input.expenseNameSnapshot,
    categorySnapshot: input.categorySnapshot,
    behaviorSnapshot: input.behaviorSnapshot,
    customerBasisSnapshot: input.customerBasisSnapshot ?? null,
    authoritativeAmount: input.authoritativeAmount.available ? input.authoritativeAmount.value : null,
    amountState: input.authoritativeAmount.available ? "actual" : "missing",
    eligibility: rule.eligibility,
    defaultDriver: rule.defaultDriver,
    eligibilityReason: rule.reason,
  };
}

export function assertUniqueAuthoritativeCostSources(
  pools: readonly Pick<
    CustomerEconomicsCostPoolFoundation,
    "authoritativeSourceType" | "authoritativeSourceId"
  >[],
) {
  const seen = new Set<string>();
  for (const pool of pools) {
    const key = `${pool.authoritativeSourceType}:${pool.authoritativeSourceId}`;
    if (seen.has(key)) throw new Error(`Duplicate authoritative cost source: ${key}`);
    seen.add(key);
  }
}

export function evaluateCustomerRevenueCoverage(
  businessNetCash: string,
  transactionNetCash: string,
) {
  const business = rationalFromDecimalString(businessNetCash);
  const transactions = rationalFromDecimalString(transactionNetCash);
  const difference = absoluteRational(subtractRationals(business, transactions));
  const absoluteBusiness = absoluteRational(business);
  const percentageTolerance = normalizeRational({
    numerator: absoluteBusiness.numerator,
    denominator: absoluteBusiness.denominator * 1000n,
  });
  const tolerance =
    compareRationals(percentageTolerance, ONE_RATIONAL) > 0
      ? percentageTolerance
      : ONE_RATIONAL;

  return {
    difference,
    tolerance,
    blocking: compareRationals(difference, tolerance) > 0,
  };
}

export function reconcileAuthoritativeCostPool(input: {
  authoritativeAmount: string | null;
  allocatedAmounts: readonly string[];
  unallocatedAmount: string | null;
}) {
  if (input.authoritativeAmount === null || input.unallocatedAmount === null) {
    return { available: false as const, reason: "INPUT_UNAVAILABLE" as const };
  }

  const authoritative = rationalFromDecimalString(input.authoritativeAmount);
  const unallocated = rationalFromDecimalString(input.unallocatedAmount);
  const allocated = input.allocatedAmounts.reduce<Rational>(
    (total, amount) => addRationals(total, rationalFromDecimalString(amount)),
    ZERO_RATIONAL,
  );
  const reconciledTotal = addRationals(allocated, unallocated);

  return {
    available: true as const,
    authoritative,
    allocated,
    unallocated,
    reconciledTotal,
    reconciles: compareRationals(reconciledTotal, authoritative) === 0,
  };
}
