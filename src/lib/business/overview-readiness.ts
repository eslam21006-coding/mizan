import type {
  CoreSetupReadiness,
  CustomerReadiness,
  HistoryReadiness,
  SalesReadiness,
} from "./readiness.ts";

export type OverviewReadinessRow = {
  key: "core" | "history" | "customers" | "sales";
  label: string;
  value: string;
  tone: "ready" | "neutral" | "attention" | "unknown";
};

export type OverviewReadinessAction = {
  domain: OverviewReadinessRow["key"];
  label: string;
  href: string;
} | null;

export type OverviewReadinessModel = {
  rows: readonly OverviewReadinessRow[];
  action: OverviewReadinessAction;
  state: "ready" | "action_required" | "unavailable";
};

/** Encodes a business identifier for safe use in B16 action URLs. */
function encodedBusinessId(businessId: string) {
  return encodeURIComponent(businessId);
}

/** Maps canonical Core readiness into compact founder-facing Arabic status copy. */
function coreLabel(core: CoreSetupReadiness) {
  if (core.loadState === "load_error") {
    return { value: "تعذر التحقق", tone: "unknown" as const };
  }
  return core.status === "ready"
    ? { value: "مكتملة", tone: "ready" as const }
    : { value: "تحتاج إكمال", tone: "attention" as const };
}

/** Maps canonical History readiness into compact founder-facing Arabic status copy. */
function historyLabel(history: HistoryReadiness) {
  if (history.loadState === "load_error") {
    return { value: "تعذر التحقق", tone: "unknown" as const };
  }
  switch (history.level) {
    case "none":
      return { value: "لا يوجد تاريخ بعد", tone: "attention" as const };
    case "one_month":
      return { value: "شهر واحد", tone: "neutral" as const };
    case "two_months":
      return { value: "شهران", tone: "neutral" as const };
    case "three_plus":
      return { value: "3 أشهر أو أكثر", tone: "ready" as const };
  }
}

/** Maps canonical Customer readiness into compact founder-facing Arabic status copy. */
function customerLabel(customers: CustomerReadiness) {
  if (customers.loadState === "load_error") {
    return { value: "تعذر التحقق", tone: "unknown" as const };
  }
  switch (customers.status) {
    case "no_transactions":
      return { value: "لا توجد معاملات", tone: "neutral" as const };
    case "imported":
      return { value: "تم الاستيراد", tone: "neutral" as const };
    case "needs_review":
      return { value: "يحتاج مراجعة", tone: "attention" as const };
    case "ready":
      return { value: "جاهزة", tone: "ready" as const };
  }
}

/** Maps canonical optional Sales readiness into compact founder-facing Arabic status copy. */
function salesLabel(sales: SalesReadiness) {
  if (sales.loadState === "load_error") {
    return { value: "تعذر التحقق", tone: "unknown" as const };
  }
  switch (sales.status) {
    case "no_funnel":
      return { value: "لم تتم إضافة طريقة بيع", tone: "neutral" as const };
    case "funnel_configured":
      return { value: "الإعداد موجود ويحتاج أرقام", tone: "neutral" as const };
    case "monthly_data_ready":
      return { value: "البيانات جاهزة", tone: "ready" as const };
  }
}

/** Resolves the one highest-priority Overview action without changing canonical readiness rules. */
export function resolveOverviewReadinessAction(input: {
  businessId: string;
  monthKey: string;
  core: CoreSetupReadiness;
  history: HistoryReadiness;
  customers: CustomerReadiness;
  sales: SalesReadiness;
}): OverviewReadinessAction {
  const id = encodedBusinessId(input.businessId);

  if (input.core.loadState === "load_error") return null;
  const coreMissing = input.core.missing[0];
  if (coreMissing) {
    switch (coreMissing) {
      case "business_identity":
        return { domain: "core", label: "راجع إعدادات البزنس", href: `/businesses/${id}/settings` };
      case "revenue_setup":
        return {
          domain: "core",
          label: "أضف مصادر الإيراد",
          href: `/businesses/${id}/setup?step=revenue`,
        };
      case "expense_setup_review":
        return {
          domain: "core",
          label: "راجع المصروفات",
          href: `/businesses/${id}/setup?step=expenses`,
        };
      case "first_valid_month":
        return {
          domain: "core",
          label: "أدخل أول شهر",
          href: `/businesses/${id}/monthly?month=${encodeURIComponent(input.monthKey)}`,
        };
    }
  }

  if (input.history.loadState === "load_error") return null;
  if (input.history.level === "none") {
    return {
      domain: "history",
      label: "أضف بيانات شهر",
      href: `/businesses/${id}/monthly?month=${encodeURIComponent(input.monthKey)}`,
    };
  }

  if (input.customers.loadState === "load_error") return null;
  if (input.customers.status === "no_transactions") {
    return {
      domain: "customers",
      label: "أضف بيانات العملاء",
      href: `/businesses/${id}/customers/import`,
    };
  }
  if (input.customers.status === "needs_review") {
    return {
      domain: "customers",
      label: "راجع بيانات العملاء",
      href: `/businesses/${id}/customers/review`,
    };
  }
  if (input.customers.status === "imported") {
    return {
      domain: "customers",
      label: "راجع تحليل العملاء",
      href: `/businesses/${id}/customers`,
    };
  }

  if (input.sales.loadState === "load_error") return null;
  if (input.sales.status === "no_funnel") {
    return {
      domain: "sales",
      label: "أضف طريقة البيع",
      href: `/businesses/${id}/funnels`,
    };
  }
  if (input.sales.status === "funnel_configured") {
    return {
      domain: "sales",
      label: "أدخل أرقام المبيعات",
      href: `/businesses/${id}/funnels/monthly?month=${encodeURIComponent(input.monthKey)}`,
    };
  }

  return null;
}

/** Builds the compact four-domain Overview readiness presentation from canonical readiness states. */
export function buildOverviewReadinessModel(input: {
  businessId: string;
  monthKey: string;
  core: CoreSetupReadiness;
  history: HistoryReadiness;
  customers: CustomerReadiness;
  sales: SalesReadiness;
}): OverviewReadinessModel {
  const rows: OverviewReadinessRow[] = [
    { key: "core", label: "الأساسيات", ...coreLabel(input.core) },
    { key: "history", label: "التاريخ", ...historyLabel(input.history) },
    { key: "customers", label: "العملاء", ...customerLabel(input.customers) },
    { key: "sales", label: "المبيعات", ...salesLabel(input.sales) },
  ];

  const unavailable =
    input.core.loadState === "load_error" ||
    input.history.loadState === "load_error" ||
    input.customers.loadState === "load_error" ||
    input.sales.loadState === "load_error";
  const action = unavailable ? null : resolveOverviewReadinessAction(input);

  return {
    rows,
    action,
    state: unavailable ? "unavailable" : action ? "action_required" : "ready",
  };
}


export type OverviewFunnelMonthlyData = {
  ad_spend: string | number | null;
  leads: number | null;
  booked_calls: number | null;
  showed_calls: number | null;
  qualified_calls: number | null;
  sales: number | null;
  new_customers: number | null;
  cash_collected: string | number | null;
  attributed_revenue: string | number | null;
};

/** Treats explicit zeroes as entered data while rejecting funnel rows containing only null/blank fields. */
export function hasMeaningfulFunnelMonthlyData(
  entries: readonly OverviewFunnelMonthlyData[],
) {
  return entries.some((entry) =>
    [
      entry.ad_spend,
      entry.leads,
      entry.booked_calls,
      entry.showed_calls,
      entry.qualified_calls,
      entry.sales,
      entry.new_customers,
      entry.cash_collected,
      entry.attributed_revenue,
    ].some((value) => value !== null && value !== undefined && String(value).trim() !== ""),
  );
}
