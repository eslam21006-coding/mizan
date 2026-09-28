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
] as const;

export type CustomerReadinessRequirement = (typeof CUSTOMER_READINESS_REQUIREMENTS)[number];

export type CustomerReadiness = {
  loadState: ReadinessLoadState;
  status: CustomerReadinessStatus;
  missing: readonly CustomerReadinessRequirement[];
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

export const PLANNING_READINESS_REQUIREMENTS = [
  "monthly_actuals",
  "core_metrics",
  "expense_actuals",
  "ad_spend_actuals",
  "funnel_actuals",
  "rolling_3_months",
] as const;

export type PlanningReadinessRequirement = (typeof PLANNING_READINESS_REQUIREMENTS)[number];

export type PlanningCapabilityReadiness = {
  loadState: ReadinessLoadState;
  ready: boolean;
  missingRequirements: readonly PlanningReadinessRequirement[];
};

export type PlanningReadiness = {
  simulator: PlanningCapabilityReadiness;
  targetPlanner: PlanningCapabilityReadiness;
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
