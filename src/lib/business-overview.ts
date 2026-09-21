export type BusinessOverviewHealthInput = {
  businessId: string;
  currentMonthKey: string;
  revenueSourceCount: number;
  expenseItemCount: number;
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

/** Resolves setup health and the single primary next action without changing any financial state. */
export function resolveBusinessOverviewHealth(
  input: BusinessOverviewHealthInput,
): BusinessOverviewHealth {
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

  const revenueSourcesReady = input.revenueSourceCount > 0;
  const expensesReady = input.expenseItemCount > 0;
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
