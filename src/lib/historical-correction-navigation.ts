type HistoricalCorrectionNavigationEffects = {
  revalidatePath: (path: string) => void;
  redirect: (path: string) => never;
};

export function buildHistoricalCorrectionPath(
  businessId: string,
  monthKey: string,
  status?: string,
) {
  const query = new URLSearchParams({ month: monthKey });
  if (status) query.set("status", status);
  return `/businesses/${encodeURIComponent(businessId)}/monthly/correction?${query.toString()}`;
}

export function buildHistoricalCorrectionSuccessHref(
  businessId: string,
  monthKey: string,
) {
  const query = new URLSearchParams({ month: monthKey, status: "corrected" });
  return `/businesses/${encodeURIComponent(businessId)}/monthly?${query.toString()}`;
}

export function historicalCorrectionRevalidationPaths(businessId: string) {
  const base = `/businesses/${encodeURIComponent(businessId)}`;
  return [
    `${base}/monthly`,
    `${base}/monthly/correction`,
    `${base}/customers`,
    `${base}/customers/review`,
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
): never {
  revalidateHistoricalCorrectionDependencies(effects, businessId);
  return effects.redirect(buildHistoricalCorrectionPath(businessId, monthKey, status));
}

export function redirectHistoricalCorrectionSuccess(
  effects: HistoricalCorrectionNavigationEffects,
  businessId: string,
  monthKey: string,
): never {
  revalidateHistoricalCorrectionDependencies(effects, businessId);
  return effects.redirect(buildHistoricalCorrectionSuccessHref(businessId, monthKey));
}
