import type { NavigationDestination } from "./navigation-hierarchy";

type SearchParamValue = string | string[] | undefined;

type SearchParamReader = {
  getAll(name: string): string[];
};

export type ReturnOriginSearchParams =
  | Readonly<Record<string, SearchParamValue>>
  | SearchParamReader;

export type ReturnOriginMetadata =
  | { origin: "customer-overview" }
  | { origin: "customer-profitability"; month?: string }
  | { origin: "monthly-editor"; month: string };

export type ReturnOriginContext = {
  businessId: string;
};

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Detects URLSearchParams-like readers without coupling this utility to Next.js. */
function isSearchParamReader(searchParams: ReturnOriginSearchParams): searchParams is SearchParamReader {
  return typeof (searchParams as Partial<SearchParamReader>).getAll === "function";
}

/** Reads exactly one value so duplicated query keys cannot create ambiguous workflow context. */
function readSingleSearchParam(searchParams: ReturnOriginSearchParams, key: string) {
  if (isSearchParamReader(searchParams)) {
    const values = searchParams.getAll(key);
    return values.length === 1 ? values[0] : null;
  }

  const value = searchParams[key];
  return typeof value === "string" ? value : null;
}

/** Parses only allow-listed structured origins; arbitrary return URLs are never accepted. */
export function parseReturnOrigin(searchParams: ReturnOriginSearchParams): ReturnOriginMetadata | null {
  const origin = readSingleSearchParam(searchParams, "origin");
  const month = readSingleSearchParam(searchParams, "month");

  if (month !== null && !MONTH_KEY_PATTERN.test(month)) {
    return null;
  }

  switch (origin) {
    case "customer-overview":
      return { origin };
    case "customer-profitability":
      return month ? { origin, month } : { origin };
    case "monthly-editor":
      return month ? { origin, month } : null;
    default:
      return null;
  }
}

/** Resolves a known workflow origin through the typed navigation destination model. */
export function resolveReturnOrigin(
  origin: ReturnOriginMetadata,
  context: ReturnOriginContext,
): NavigationDestination {
  switch (origin.origin) {
    case "customer-overview":
      return { route: "business-customers", businessId: context.businessId };
    case "customer-profitability":
      return {
        route: "business-customers",
        businessId: context.businessId,
        view: "profitability",
        month: origin.month,
      };
    case "monthly-editor":
      return {
        route: "business-monthly",
        businessId: context.businessId,
        month: origin.month,
      };
  }
}
