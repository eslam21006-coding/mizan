import {
  resolveCoreSetupReadiness,
  resolveExpenseSetupReviewState,
  type CoreSetupReadiness,
  type ReadinessLoadState,
} from "./readiness.ts";
import type { BusinessSetupStep } from "./setup-navigation.ts";

export type BusinessSetupReadinessInput = {
  loadState: ReadinessLoadState;
  revenueSourceCount: number | null;
  expenseSetupReviewedAt: string | null;
  validMonthCount: number | null;
};

export type BusinessSetupReadiness = {
  loadState: ReadinessLoadState;
  coreSetup: CoreSetupReadiness;
  completedStepCount: number | null;
  stepComplete: Readonly<Record<BusinessSetupStep, boolean>>;
};

export type BusinessSetupQueryErrors = {
  revenueSourcesError: unknown;
  activeRevenueSourceCountError: unknown;
  latestPeriodError: unknown;
};

export type BusinessSetupQueryState = { kind: "loaded" } | { kind: "load_error" };

/** Resolves whether any authoritative setup query failed before readiness is derived. */
export function resolveBusinessSetupQueryState(
  input: BusinessSetupQueryErrors,
): BusinessSetupQueryState {
  if (
    input.revenueSourcesError ||
    input.activeRevenueSourceCountError ||
    input.latestPeriodError
  ) {
    return { kind: "load_error" };
  }

  return { kind: "loaded" };
}

/** Resolves the four canonical setup facts without legacy compatibility inference. */
export function resolveBusinessSetupReadiness(
  input: BusinessSetupReadinessInput,
): BusinessSetupReadiness {
  if (input.loadState === "load_error") {
    return {
      loadState: "load_error",
      coreSetup: resolveCoreSetupReadiness({
        loadState: "load_error",
        businessIdentityReady: null,
        revenueSourceCount: null,
        expenseSetup: "unknown",
        validMonthCount: null,
      }),
      completedStepCount: null,
      stepComplete: {
        business: false,
        revenue: false,
        expenses: false,
        month: false,
      },
    };
  }

  const expenseSetup = resolveExpenseSetupReviewState({
    loadState: "loaded",
    reviewedAt: input.expenseSetupReviewedAt,
  });
  const coreSetup = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: input.revenueSourceCount,
    expenseSetup,
    validMonthCount: input.validMonthCount,
  });
  const stepComplete = {
    business: coreSetup.businessIdentityReady,
    revenue: coreSetup.revenueSetupReady,
    expenses: coreSetup.expenseSetup === "reviewed",
    month: coreSetup.firstValidMonthReady,
  } satisfies Record<BusinessSetupStep, boolean>;

  return {
    loadState: "loaded",
    coreSetup,
    completedStepCount: Object.values(stepComplete).filter(Boolean).length,
    stepComplete,
  };
}
