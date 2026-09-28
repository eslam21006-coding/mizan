import { resolveBusinessSetupCompatibility } from "./business/setup-compatibility.ts";

export type BusinessOverviewHealthInput = {
  businessId: string;
  currentMonthKey: string;
  revenueSourceCount: number;
  expenseItemCount: number;
  configuredExpenseItemCount?: number;
  expenseSetupReviewedAt?: string | null;
  currentMonthSaved: boolean;
  latestSavedMonthKey: string | null;
  canManage: boolean;
  dataLoadError: boolean;
};

export type BusinessOverviewNextAction =
  | { kind: "revenue-streams"; href: string; label: string }
  | { kind: "expenses"; href: string; label: string }
  | { kind: "monthly"; href: string; label: string }
  | null;

export type BusinessOverviewHealth = {
  revenueSourcesReady: boolean;
  expensesReady: boolean;
  currentMonthSaved: boolean;
  latestSavedMonthKey: string | null;
  nextAction: BusinessOverviewNextAction;
  dataLoadError: boolean;
};

/** Formats a YYYY-MM key as an Arabic month/year label without depending on business timezone. */
export function formatArabicMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthKey}-01T00:00:00.000Z`));
}

/** Builds the deterministic Monthly destination used by the business Overview primary action. */
export function buildBusinessMonthlyHref(businessId: string, monthKey: string) {
  const searchParams = new URLSearchParams({ month: monthKey });
  return `/businesses/${encodeURIComponent(businessId)}/monthly?${searchParams.toString()}`;
}

/**
 * Preserves the existing Overview contract while resolving pre-wizard businesses through B03.
 *
 * Legacy compatibility may accept explicit review, configured expense definitions, or saved monthly
 * history as expense-setup evidence. The existing Overview still means "ready for monthly entry"
 * when revenue and effective expense setup are ready; B03 Core completion itself also requires a
 * first saved month.
 */
export function resolveBusinessOverviewHealth(
  input: BusinessOverviewHealthInput,
): BusinessOverviewHealth {
  const compatibility = resolveBusinessSetupCompatibility({
    loadState: input.dataLoadError ? "load_error" : "loaded",
    mode: "legacy",
    revenueSourceCount: input.dataLoadError ? null : input.revenueSourceCount,
    expenseSetupReviewedAt: input.expenseSetupReviewedAt ?? null,
    configuredExpenseItemCount: input.dataLoadError
      ? null
      : (input.configuredExpenseItemCount ?? input.expenseItemCount),
    validMonthCount: input.dataLoadError ? null : input.latestSavedMonthKey === null ? 0 : 1,
  });

  if (input.dataLoadError) {
    return {
      revenueSourcesReady: false,
      expensesReady: false,
      currentMonthSaved: false,
      latestSavedMonthKey: null,
      nextAction: null,
      dataLoadError: true,
    };
  }

  const revenueSourcesReady = compatibility.coreSetup.revenueSetupReady;
  const expensesReady = compatibility.effectiveExpenseSetup === "reviewed";
  let nextAction: BusinessOverviewNextAction;

  if (!revenueSourcesReady) {
    nextAction = {
      kind: "revenue-streams",
      href: `/businesses/${encodeURIComponent(input.businessId)}/revenue-streams`,
      label: input.canManage ? "إضافة مصدر إيراد" : "مراجعة مصادر الإيراد",
    };
  } else if (!expensesReady) {
    nextAction = {
      kind: "expenses",
      href: `/businesses/${encodeURIComponent(input.businessId)}/expenses`,
      label: input.canManage ? "إضافة بند مصروف" : "مراجعة هيكل المصروفات",
    };
  } else {
    nextAction = {
      kind: "monthly",
      href: buildBusinessMonthlyHref(input.businessId, input.currentMonthKey),
      label: `فتح أرقام ${formatArabicMonthLabel(input.currentMonthKey)}`,
    };
  }

  return {
    revenueSourcesReady,
    expensesReady,
    currentMonthSaved: input.currentMonthSaved,
    latestSavedMonthKey: input.latestSavedMonthKey,
    nextAction,
    dataLoadError: false,
  };
}
