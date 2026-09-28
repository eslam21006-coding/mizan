import {
  resolveCoreSetupReadiness,
  resolveExpenseSetupReviewState,
  type CoreSetupReadiness,
  type CoreSetupRequirement,
  type ExpenseSetupReviewState,
  type ReadinessLoadState,
} from "./readiness.ts";

export const SETUP_COMPATIBILITY_MODES = ["legacy", "canonical"] as const;
export type SetupCompatibilityMode = (typeof SETUP_COMPATIBILITY_MODES)[number];

export const BUSINESS_SETUP_COMPATIBILITY_STATUSES = [
  "ready",
  "partially_configured",
  "needs_setup",
] as const;
export type BusinessSetupCompatibilityStatus =
  (typeof BUSINESS_SETUP_COMPATIBILITY_STATUSES)[number];

export const EXPENSE_COMPATIBILITY_SOURCES = [
  "explicit_review",
  "legacy_expense_configuration",
  "legacy_month_history",
  "none",
  "unknown",
] as const;
export type ExpenseCompatibilitySource = (typeof EXPENSE_COMPATIBILITY_SOURCES)[number];

export type BusinessSetupCompatibilityInput = {
  loadState: ReadinessLoadState;
  mode: SetupCompatibilityMode;
  revenueSourceCount: number | null;
  expenseSetupReviewedAt: string | null;
  configuredExpenseItemCount: number | null;
  validMonthCount: number | null;
};

export type BusinessSetupCompatibility = {
  loadState: ReadinessLoadState;
  mode: SetupCompatibilityMode;
  status: BusinessSetupCompatibilityStatus | null;
  coreSetup: CoreSetupReadiness;
  nextRequirement: CoreSetupRequirement | null;
  effectiveExpenseSetup: ExpenseSetupReviewState;
  expenseCompatibilitySource: ExpenseCompatibilitySource;
};

/** Rejects invalid compatibility counts before they can be treated as legacy evidence. */
function requiredCompatibilityCount(value: number | null, fieldName: string) {
  if (value === null) {
    throw new Error(`${fieldName} must be available for loaded legacy compatibility.`);
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative safe integer.`);
  }
  return value;
}

/**
 * Resolves existing-business setup compatibility without persisting inferred completion.
 *
 * Legacy mode may treat configured expense definitions or saved monthly history as compatibility
 * evidence. Canonical mode preserves B02 semantics and accepts only explicit expense review.
 */
export function resolveBusinessSetupCompatibility(
  input: BusinessSetupCompatibilityInput,
): BusinessSetupCompatibility {
  if (input.loadState === "load_error") {
    const coreSetup = resolveCoreSetupReadiness({
      loadState: "load_error",
      businessIdentityReady: null,
      revenueSourceCount: null,
      expenseSetup: "unknown",
      validMonthCount: null,
    });

    return {
      loadState: "load_error",
      mode: input.mode,
      status: null,
      coreSetup,
      nextRequirement: null,
      effectiveExpenseSetup: "unknown",
      expenseCompatibilitySource: "unknown",
    };
  }

  const explicitExpenseSetup = resolveExpenseSetupReviewState({
    loadState: "loaded",
    reviewedAt: input.expenseSetupReviewedAt,
  });

  let effectiveExpenseSetup: ExpenseSetupReviewState = explicitExpenseSetup;
  let expenseCompatibilitySource: ExpenseCompatibilitySource =
    explicitExpenseSetup === "reviewed" ? "explicit_review" : "none";

  if (input.mode === "legacy" && explicitExpenseSetup !== "reviewed") {
    const configuredExpenseItemCount = requiredCompatibilityCount(
      input.configuredExpenseItemCount,
      "configuredExpenseItemCount",
    );

    if (configuredExpenseItemCount > 0) {
      effectiveExpenseSetup = "reviewed";
      expenseCompatibilitySource = "legacy_expense_configuration";
    } else if (input.validMonthCount !== null && input.validMonthCount > 0) {
      effectiveExpenseSetup = "reviewed";
      expenseCompatibilitySource = "legacy_month_history";
    }
  }

  const coreSetup = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: input.revenueSourceCount,
    expenseSetup: effectiveExpenseSetup,
    validMonthCount: input.validMonthCount,
  });

  const hasMeaningfulProgress =
    coreSetup.revenueSetupReady ||
    coreSetup.expenseSetup === "reviewed" ||
    coreSetup.firstValidMonthReady;

  return {
    loadState: "loaded",
    mode: input.mode,
    status:
      coreSetup.status === "ready"
        ? "ready"
        : hasMeaningfulProgress
          ? "partially_configured"
          : "needs_setup",
    coreSetup,
    nextRequirement: coreSetup.missing[0] ?? null,
    effectiveExpenseSetup,
    expenseCompatibilitySource,
  };
}
