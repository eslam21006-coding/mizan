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

type SingleSearchParam =
  | { status: "missing" }
  | { status: "value"; value: string }
  | { status: "ambiguous" };

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Detects URLSearchParams-like readers without coupling this utility to Next.js. */
function isSearchParamReader(searchParams: ReturnOriginSearchParams): searchParams is SearchParamReader {
  return typeof (searchParams as Partial<SearchParamReader>).getAll === "function";
}

/** Distinguishes missing metadata from duplicated/ambiguous metadata. */
function readSingleSearchParam(
  searchParams: ReturnOriginSearchParams,
  key: string,
): SingleSearchParam {
  if (isSearchParamReader(searchParams)) {
    const values = searchParams.getAll(key);
    if (values.length === 0) return { status: "missing" };
    if (values.length === 1) return { status: "value", value: values[0] };
    return { status: "ambiguous" };
  }

  const value = searchParams[key];
  if (value === undefined) return { status: "missing" };
  if (typeof value === "string") return { status: "value", value };
  return { status: "ambiguous" };
}

/** Parses only allow-listed structured origins; arbitrary return URLs are never accepted. */
export function parseReturnOrigin(searchParams: ReturnOriginSearchParams): ReturnOriginMetadata | null {
  const originParam = readSingleSearchParam(searchParams, "origin");
  const monthParam = readSingleSearchParam(searchParams, "month");

  if (originParam.status !== "value" || monthParam.status === "ambiguous") {
    return null;
  }

  const month = monthParam.status === "value" ? monthParam.value : undefined;
  if (month !== undefined && !MONTH_KEY_PATTERN.test(month)) {
    return null;
  }

  switch (originParam.value) {
    case "customer-overview":
      return { origin: "customer-overview" };
    case "customer-profitability":
      return month ? { origin: "customer-profitability", month } : { origin: "customer-profitability" };
    case "monthly-editor":
      return month ? { origin: "monthly-editor", month } : null;
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
