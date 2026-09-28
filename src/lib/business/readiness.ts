import type { SimulatorMonthBlocker } from "./simulator-month.ts";
import type { TargetPlannerActualMonthBlocker } from "./target-planner-actuals.ts";

export const BUSINESS_READINESS_DOMAINS = [
  "coreSetup",
  "history",
  "customers",
  "sales",
  "planning",
] as const;

export type BusinessReadinessDomain = (typeof BUSINESS_READINESS_DOMAINS)[number];

export const READINESS_LOAD_STATES = ["loaded", "load_error"] as const;
export type ReadinessLoadState = (typeof READINESS_LOAD_STATES)[number];

export const READINESS_VALUE_STATES = [
  "unknown",
  "explicit_zero_or_none",
  "not_applicable",
  "present",
] as const;

export type ReadinessValueState = (typeof READINESS_VALUE_STATES)[number];

export const CORE_SETUP_STATUSES = ["ready", "incomplete"] as const;
export type CoreSetupStatus = (typeof CORE_SETUP_STATUSES)[number];

export const EXPENSE_SETUP_REVIEW_STATES = ["reviewed", "not_reviewed", "unknown"] as const;
export type ExpenseSetupReviewState = (typeof EXPENSE_SETUP_REVIEW_STATES)[number];

export type ExpenseSetupReviewStateInput = {
  loadState: ReadinessLoadState;
  reviewedAt: string | null;
};

export const CORE_SETUP_REQUIREMENTS = [
  "business_identity",
  "revenue_setup",
  "expense_setup_review",
  "first_valid_month",
] as const;

export type CoreSetupRequirement = (typeof CORE_SETUP_REQUIREMENTS)[number];

export type CoreSetupReadiness = {
  loadState: ReadinessLoadState;
  status: CoreSetupStatus;
  businessIdentityReady: boolean;
  revenueSetupReady: boolean;
  expenseSetup: ExpenseSetupReviewState;
  firstValidMonthReady: boolean;
  missing: readonly CoreSetupRequirement[];
};

export type CoreSetupReadinessInput = {
  loadState: ReadinessLoadState;
  businessIdentityReady: boolean | null;
  revenueSourceCount: number | null;
  expenseSetup: ExpenseSetupReviewState;
  validMonthCount: number | null;
};

export const HISTORY_READINESS_LEVELS = [
  "none",
  "one_month",
  "two_months",
  "three_plus",
] as const;

export type HistoryReadinessLevel = (typeof HISTORY_READINESS_LEVELS)[number];

export type HistoryReadiness = {
  loadState: ReadinessLoadState;
  validMonthCount: number;
  level: HistoryReadinessLevel;
};

export type HistoryReadinessInput = {
  loadState: ReadinessLoadState;
  validMonthCount: number | null;
};

export const CUSTOMER_READINESS_STATUSES = [
  "no_transactions",
  "imported",
  "needs_review",
  "ready",
] as const;

export type CustomerReadinessStatus = (typeof CUSTOMER_READINESS_STATUSES)[number];

export const CUSTOMER_READINESS_REQUIREMENTS = [
  "transaction_history",
  "transaction_import",
  "customer_review",
  "customer_analysis",
] as const;

export type CustomerReadinessRequirement = (typeof CUSTOMER_READINESS_REQUIREMENTS)[number];

export type CustomerReadiness = {
  loadState: ReadinessLoadState;
  status: CustomerReadinessStatus;
  missing: readonly CustomerReadinessRequirement[];
};

export type CustomerReadinessInput = {
  loadState: ReadinessLoadState;
  transactionCount: number | null;
  reviewIssueCount: number | null;
  analysisReady: boolean | null;
};

export const SALES_READINESS_STATUSES = [
  "no_funnel",
  "funnel_configured",
  "monthly_data_ready",
] as const;

export type SalesReadinessStatus = (typeof SALES_READINESS_STATUSES)[number];

export const SALES_READINESS_REQUIREMENTS = [
  "funnel_configuration",
  "funnel_monthly_data",
] as const;

export type SalesReadinessRequirement = (typeof SALES_READINESS_REQUIREMENTS)[number];

export type SalesReadiness = {
  loadState: ReadinessLoadState;
  status: SalesReadinessStatus;
  missing: readonly SalesReadinessRequirement[];
};

export type SalesReadinessInput = {
  loadState: ReadinessLoadState;
  funnelCount: number | null;
  monthlyDataReady: boolean | null;
};

export const PLANNING_READINESS_REQUIREMENTS = [
  "monthly_actuals",
  "core_metrics",
  "expense_actuals",
  "positive_new_customers",
  "ad_spend_actuals",
  "funnel_actuals",
  "rolling_3_months",
  "data_consistency",
] as const;

export type PlanningReadinessRequirement = (typeof PLANNING_READINESS_REQUIREMENTS)[number];

export type PlanningCapabilityReadiness = {
  loadState: ReadinessLoadState;
  ready: boolean;
  missingRequirements: readonly PlanningReadinessRequirement[];
};

export type PlanningCapabilityReadinessInput = {
  loadState: ReadinessLoadState;
  missingRequirements: readonly PlanningReadinessRequirement[];
};

export type PlanningReadiness = {
  simulator: PlanningCapabilityReadiness;
  targetPlanner: PlanningCapabilityReadiness;
};

export type PlanningReadinessInput = {
  simulator: PlanningCapabilityReadinessInput;
  targetPlanner: PlanningCapabilityReadinessInput;
};

/**
 * Describes which Mizan capabilities have sufficient authoritative data.
 *
 * This contract intentionally has no global "ready" flag: Customers, Sales, and Planning are
 * progressive capabilities and must never be required for Core Setup readiness.
 */
export type BusinessReadiness = {
  coreSetup: CoreSetupReadiness;
  history: HistoryReadiness;
  customers: CustomerReadiness;
  sales: SalesReadiness;
  planning: PlanningReadiness;
};

export type BusinessReadinessInput = {
  coreSetup: CoreSetupReadinessInput;
  history: HistoryReadinessInput;
  customers: CustomerReadinessInput;
  sales: SalesReadinessInput;
  planning: PlanningReadinessInput;
};

/** Rejects invalid count facts before they can be interpreted as readiness. */
function assertNonNegativeSafeInteger(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative safe integer.`);
  }
}

/** Requires a concrete non-negative count when the caller says the domain loaded successfully. */
function requiredLoadedCount(value: number | null, fieldName: string) {
  if (value === null) {
    throw new Error(`${fieldName} must be available when readiness loadState is loaded.`);
  }
  assertNonNegativeSafeInteger(value, fieldName);
  return value;
}

/** Requires a concrete boolean fact when the caller says the domain loaded successfully. */
function requiredLoadedBoolean(value: boolean | null, fieldName: string) {
  if (value === null) {
    throw new Error(`${fieldName} must be available when readiness loadState is loaded.`);
  }
  return value;
}

/** Preserves first-seen requirement order while removing duplicate blocker mappings. */
function uniqueRequirements<T extends string>(requirements: readonly T[]) {
  return [...new Set(requirements)];
}

/** Maps persisted expense-review metadata into the storage-agnostic B01 readiness state. */
export function resolveExpenseSetupReviewState(
  input: ExpenseSetupReviewStateInput,
): ExpenseSetupReviewState {
  if (input.loadState === "load_error") {
    return "unknown";
  }
  return input.reviewedAt === null ? "not_reviewed" : "reviewed";
}

/** Resolves only mandatory Core Setup readiness; optional capabilities never participate. */
export function resolveCoreSetupReadiness(input: CoreSetupReadinessInput): CoreSetupReadiness {
  if (input.loadState === "load_error") {
    return {
      loadState: "load_error",
      status: "incomplete",
      businessIdentityReady: false,
      revenueSetupReady: false,
      expenseSetup: "unknown",
      firstValidMonthReady: false,
      missing: [...CORE_SETUP_REQUIREMENTS],
    };
  }

  const businessIdentityReady = requiredLoadedBoolean(
    input.businessIdentityReady,
    "businessIdentityReady",
  );
  const revenueSourceCount = requiredLoadedCount(input.revenueSourceCount, "revenueSourceCount");
  const validMonthCount = requiredLoadedCount(input.validMonthCount, "validMonthCount");
  const revenueSetupReady = revenueSourceCount > 0;
  const firstValidMonthReady = validMonthCount > 0;
  const missing: CoreSetupRequirement[] = [];

  if (!businessIdentityReady) missing.push("business_identity");
  if (!revenueSetupReady) missing.push("revenue_setup");
  if (input.expenseSetup !== "reviewed") missing.push("expense_setup_review");
  if (!firstValidMonthReady) missing.push("first_valid_month");

  return {
    loadState: "loaded",
    status: missing.length === 0 ? "ready" : "incomplete",
    businessIdentityReady,
    revenueSetupReady,
    expenseSetup: input.expenseSetup,
    firstValidMonthReady,
    missing,
  };
}

/** Buckets valid monthly history without discarding the exact count. */
export function resolveHistoryReadiness(input: HistoryReadinessInput): HistoryReadiness {
  if (input.loadState === "load_error") {
    return { loadState: "load_error", validMonthCount: 0, level: "none" };
  }

  const validMonthCount = requiredLoadedCount(input.validMonthCount, "validMonthCount");
  const level: HistoryReadinessLevel =
    validMonthCount === 0
      ? "none"
      : validMonthCount === 1
        ? "one_month"
        : validMonthCount === 2
          ? "two_months"
          : "three_plus";

  return { loadState: "loaded", validMonthCount, level };
}

/** Maps existing transaction/customer-analysis facts into the progressive customer-data state. */
export function resolveCustomerReadiness(input: CustomerReadinessInput): CustomerReadiness {
  if (input.loadState === "load_error") {
    return {
      loadState: "load_error",
      status: "no_transactions",
      missing: [...CUSTOMER_READINESS_REQUIREMENTS],
    };
  }

  const transactionCount = requiredLoadedCount(input.transactionCount, "transactionCount");
  const reviewIssueCount = requiredLoadedCount(input.reviewIssueCount, "reviewIssueCount");
  const analysisReady = requiredLoadedBoolean(input.analysisReady, "analysisReady");

  if (transactionCount === 0) {
    return {
      loadState: "loaded",
      status: "no_transactions",
      missing: ["transaction_history", "transaction_import"],
    };
  }
  if (reviewIssueCount > 0) {
    return { loadState: "loaded", status: "needs_review", missing: ["customer_review"] };
  }
  if (analysisReady) {
    return { loadState: "loaded", status: "ready", missing: [] };
  }
  return { loadState: "loaded", status: "imported", missing: ["customer_analysis"] };
}

/** Treats funnels as optional while reporting whether funnel analysis itself is usable. */
export function resolveSalesReadiness(input: SalesReadinessInput): SalesReadiness {
  if (input.loadState === "load_error") {
    return {
      loadState: "load_error",
      status: "no_funnel",
      missing: [...SALES_READINESS_REQUIREMENTS],
    };
  }

  const funnelCount = requiredLoadedCount(input.funnelCount, "funnelCount");
  const monthlyDataReady = requiredLoadedBoolean(input.monthlyDataReady, "monthlyDataReady");

  if (funnelCount === 0) {
    return {
      loadState: "loaded",
      status: "no_funnel",
      missing: ["funnel_configuration"],
    };
  }
  if (!monthlyDataReady) {
    return {
      loadState: "loaded",
      status: "funnel_configured",
      missing: ["funnel_monthly_data"],
    };
  }
  return { loadState: "loaded", status: "monthly_data_ready", missing: [] };
}

/** Resolves one planning capability from existing authoritative prerequisite checks. */
export function resolvePlanningCapabilityReadiness(
  input: PlanningCapabilityReadinessInput,
): PlanningCapabilityReadiness {
  const missingRequirements = uniqueRequirements(input.missingRequirements);
  return {
    loadState: input.loadState,
    ready: input.loadState === "loaded" && missingRequirements.length === 0,
    missingRequirements,
  };
}

/** Converts existing Simulator month blockers into central readiness requirements. */
export function planningRequirementForSimulatorBlocker(
  blocker: SimulatorMonthBlocker,
): PlanningReadinessRequirement {
  switch (blocker) {
    case "MONTH_NOT_SAVED":
    case "MONTH_DATA_UNAVAILABLE":
      return "monthly_actuals";
    case "MONTH_CALCULATION_INVALID":
    case "NET_CASH_UNAVAILABLE":
    case "COSTS_UNAVAILABLE":
    case "NEW_CUSTOMERS_UNAVAILABLE":
      return "core_metrics";
    case "VARIABLE_COSTS_UNAVAILABLE":
      return "expense_actuals";
    case "NO_NEW_CUSTOMERS":
      return "positive_new_customers";
    case "AD_SPEND_UNAVAILABLE":
      return "ad_spend_actuals";
    case "SCENARIO_BASELINE_INCONSISTENT":
      return "data_consistency";
  }
}

/** Converts existing Target Planner month blockers into central readiness requirements. */
export function planningRequirementForTargetPlannerBlocker(
  blocker: TargetPlannerActualMonthBlocker,
): PlanningReadinessRequirement {
  switch (blocker) {
    case "CORE_METRIC_UNAVAILABLE":
      return "core_metrics";
    case "EXPENSE_AMOUNT_UNAVAILABLE":
      return "expense_actuals";
    case "AD_SPEND_UNAVAILABLE":
      return "ad_spend_actuals";
    case "FUNNEL_DATA_UNAVAILABLE":
      return "funnel_actuals";
    case "MEDIA_EXCEEDS_FIXED_ACQUISITION":
    case "FUNNEL_CUSTOMER_MISMATCH":
    case "FUNNEL_SEQUENCE_INVALID":
      return "data_consistency";
  }
}

/** Resolves every readiness domain from already-authoritative business facts and prerequisite results. */
export function resolveBusinessReadiness(input: BusinessReadinessInput): BusinessReadiness {
  return {
    coreSetup: resolveCoreSetupReadiness(input.coreSetup),
    history: resolveHistoryReadiness(input.history),
    customers: resolveCustomerReadiness(input.customers),
    sales: resolveSalesReadiness(input.sales),
    planning: {
      simulator: resolvePlanningCapabilityReadiness(input.planning.simulator),
      targetPlanner: resolvePlanningCapabilityReadiness(input.planning.targetPlanner),
    },
  };
}
