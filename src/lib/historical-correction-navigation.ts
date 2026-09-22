import type { MonthlyExternalReturnOrigin } from "./monthly-return-origin.ts";

type HistoricalCorrectionNavigationEffects = {
  revalidatePath: (path: string) => void;
  redirect: (path: string) => never;
};

/** Appends validated external Return metadata to a historical-correction URL. */
function appendHistoricalReturnQuery(
  query: URLSearchParams,
  returnOrigin?: MonthlyExternalReturnOrigin | null,
) {
  if (!returnOrigin) return;

  query.set("origin", returnOrigin.origin);
  if (
    (returnOrigin.origin === "customer-profitability" ||
      returnOrigin.origin === "insights") &&
    returnOrigin.month
  ) {
    query.set("return_month", returnOrigin.month);
  }
  if (returnOrigin.origin === "insights") {
    query.set("insight_rule", returnOrigin.ruleId);
    if (returnOrigin.subjectId) query.set("insight_subject", returnOrigin.subjectId);
  }
  if (returnOrigin.origin === "target-planner") {
    query.set("planner_step", returnOrigin.step);
    query.set("planner_goal", returnOrigin.goal);
    if (returnOrigin.value !== undefined) query.set("planner_value", returnOrigin.value);
  }
}

export function buildHistoricalCorrectionPath(
  businessId: string,
  monthKey: string,
  status?: string,
  returnOrigin?: MonthlyExternalReturnOrigin | null,
) {
  const query = new URLSearchParams({ month: monthKey });
  if (status) query.set("status", status);
  appendHistoricalReturnQuery(query, returnOrigin);
  return `/businesses/${encodeURIComponent(businessId)}/monthly/correction?${query.toString()}`;
}

export function buildHistoricalCorrectionSuccessHref(
  businessId: string,
  monthKey: string,
  returnOrigin?: MonthlyExternalReturnOrigin | null,
) {
  const query = new URLSearchParams({ month: monthKey, status: "corrected" });
  appendHistoricalReturnQuery(query, returnOrigin);
  return `/businesses/${encodeURIComponent(businessId)}/monthly?${query.toString()}`;
}

export function historicalCorrectionRevalidationPaths(businessId: string) {
  const base = `/businesses/${encodeURIComponent(businessId)}`;
  return [
    `${base}/monthly`,
    `${base}/monthly/correction`,
    `${base}/customers`,
    `${base}/customers/review`,
    "/insights",
    "/target-plan",
  ] as const;
}

function revalidateHistoricalCorrectionDependencies(
  effects: HistoricalCorrectionNavigationEffects,
  businessId: string,
) {
  for (const path of historicalCorrectionRevalidationPaths(businessId)) {
    effects.revalidatePath(path);
  }
}

export function redirectHistoricalCorrection(
  effects: HistoricalCorrectionNavigationEffects,
  businessId: string,
  monthKey: string,
  status: string,
  returnOrigin?: MonthlyExternalReturnOrigin | null,
): never {
  revalidateHistoricalCorrectionDependencies(effects, businessId);
  return effects.redirect(
    buildHistoricalCorrectionPath(businessId, monthKey, status, returnOrigin),
  );
}

export function redirectHistoricalCorrectionSuccess(
  effects: HistoricalCorrectionNavigationEffects,
  businessId: string,
  monthKey: string,
  returnOrigin?: MonthlyExternalReturnOrigin | null,
): never {
  revalidateHistoricalCorrectionDependencies(effects, businessId);
  return effects.redirect(
    buildHistoricalCorrectionSuccessHref(businessId, monthKey, returnOrigin),
  );
}
