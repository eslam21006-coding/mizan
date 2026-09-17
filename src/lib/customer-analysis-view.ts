export const CUSTOMER_ANALYSIS_VIEWS = [
  "overview",
  "value",
  "profitability",
  "revenue-streams",
  "customers",
] as const;

export type CustomerAnalysisView = (typeof CUSTOMER_ANALYSIS_VIEWS)[number];
export type CustomerSearchParamValue = string | string[] | undefined;
export type CustomerSearchParams = Readonly<Record<string, CustomerSearchParamValue>>;

/** Returns a known Customer view and safely falls back to Overview for missing, invalid, or duplicate values. */
export function parseCustomerAnalysisView(value: CustomerSearchParamValue): CustomerAnalysisView {
  const candidate = Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value;
  if (!candidate) return "overview";

  return CUSTOMER_ANALYSIS_VIEWS.includes(candidate as CustomerAnalysisView)
    ? (candidate as CustomerAnalysisView)
    : "overview";
}

/** Builds a business-scoped Customer view URL while preserving unrelated structured query state. */
export function buildCustomerAnalysisViewHref(
  businessId: string,
  searchParams: CustomerSearchParams,
  view: CustomerAnalysisView,
) {
  const params = new URLSearchParams();
  params.set("view", view);

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "view" || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }

  return `/businesses/${encodeURIComponent(businessId)}/customers?${params.toString()}`;
}
