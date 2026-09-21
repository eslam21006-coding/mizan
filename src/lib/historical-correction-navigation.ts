export function buildHistoricalCorrectionSuccessHref(
  businessId: string,
  monthKey: string,
) {
  const query = new URLSearchParams({ month: monthKey, status: "corrected" });
  return `/businesses/${encodeURIComponent(businessId)}/monthly?${query.toString()}`;
}
