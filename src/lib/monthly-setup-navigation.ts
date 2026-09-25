import type { MonthlyExternalReturnOrigin } from "./monthly-return-origin.ts";

export type MonthlySetupRoute = "revenue-streams" | "expenses";

/** Appends validated external Return context as nested Monthly-editor setup metadata. */
function appendSetupUpstreamQuery(
  query: URLSearchParams,
  returnOrigin: MonthlyExternalReturnOrigin,
) {
  query.set("upstream_origin", returnOrigin.origin);
  if (
    (returnOrigin.origin === "customer-profitability" ||
      returnOrigin.origin === "insights") &&
    returnOrigin.month
  ) {
    query.set("upstream_month", returnOrigin.month);
  }
  if (returnOrigin.origin === "insights") {
    query.set("upstream_insight_rule", returnOrigin.ruleId);
    if (returnOrigin.subjectId) {
      query.set("upstream_insight_subject", returnOrigin.subjectId);
    }
  }
  if (returnOrigin.origin === "target-planner") {
    query.set("upstream_planner_step", returnOrigin.step);
    query.set("upstream_planner_goal", returnOrigin.goal);
    if (returnOrigin.value !== undefined) {
      query.set("upstream_planner_value", returnOrigin.value);
    }
  }
}

/** Builds a safe Monthly → setup detour URL while preserving any validated upstream workflow. */
export function buildMonthlySetupHref(
  businessId: string,
  route: MonthlySetupRoute,
  monthKey: string,
  returnOrigin: MonthlyExternalReturnOrigin | null = null,
) {
  const query = new URLSearchParams({
    origin: "monthly-editor",
    month: monthKey,
  });
  if (returnOrigin) appendSetupUpstreamQuery(query, returnOrigin);

  return `/businesses/${encodeURIComponent(businessId)}/${route}?${query.toString()}`;
}
