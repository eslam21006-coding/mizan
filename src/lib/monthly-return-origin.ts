import {
  parseReturnOrigin,
  type ReturnOriginMetadata,
  type ReturnOriginSearchParams,
} from "./return-origin.ts";

export type MonthlyExternalReturnOrigin = Extract<
  ReturnOriginMetadata,
  | { origin: "customer-overview" }
  | { origin: "customer-profitability" }
  | { origin: "insights" }
>;

/** Accepts only cross-module origins that may legitimately return from the Monthly editor. */
export function parseMonthlyExternalReturnOrigin(
  searchParams: ReturnOriginSearchParams,
): MonthlyExternalReturnOrigin | null {
  const parsed = parseReturnOrigin(searchParams);
  if (
    parsed?.origin === "customer-overview" ||
    parsed?.origin === "customer-profitability" ||
    parsed?.origin === "insights"
  ) {
    return parsed;
  }

  return null;
}
