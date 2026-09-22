import {
  parseReturnOrigin,
  type CustomerReturnOriginMetadata,
  type InsightReturnOriginMetadata,
  type ReturnOriginSearchParams,
  type TargetPlannerReturnOriginMetadata,
} from "./return-origin.ts";

export type MonthlyExternalReturnOrigin =
  | CustomerReturnOriginMetadata
  | InsightReturnOriginMetadata
  | TargetPlannerReturnOriginMetadata;

/** Accepts only cross-module origins that may legitimately return from the Monthly editor. */
export function parseMonthlyExternalReturnOrigin(
  searchParams: ReturnOriginSearchParams,
): MonthlyExternalReturnOrigin | null {
  const parsed = parseReturnOrigin(searchParams);
  if (
    parsed?.origin === "customer-overview" ||
    parsed?.origin === "customer-profitability" ||
    parsed?.origin === "insights" ||
    parsed?.origin === "target-planner"
  ) {
    return parsed;
  }

  return null;
}
