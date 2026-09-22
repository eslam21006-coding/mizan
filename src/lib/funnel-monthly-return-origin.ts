import {
  parseReturnOrigin,
  type ReturnOriginMetadata,
  type ReturnOriginSearchParams,
} from "./return-origin.ts";

export type FunnelMonthlyReturnOrigin = Extract<
  ReturnOriginMetadata,
  { origin: "funnel-structure" } | { origin: "insights" }
>;

/** Accepts only structured Funnel Structure or Insights origins for the Funnel Monthly workflow. */
export function parseFunnelMonthlyReturnOrigin(
  searchParams: ReturnOriginSearchParams,
): FunnelMonthlyReturnOrigin | null {
  const parsed = parseReturnOrigin(searchParams);
  return parsed?.origin === "funnel-structure" || parsed?.origin === "insights"
    ? parsed
    : null;
}
