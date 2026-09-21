import {
  parseReturnOrigin,
  type CustomerReturnOriginMetadata,
  type ReturnOriginSearchParams,
} from "./return-origin";

type SearchParamRecord = Readonly<Record<string, string | string[] | undefined>>;
type SearchParamReader = {
  getAll(name: string): string[];
};

export type SetupReturnOrigin = {
  origin: "monthly-editor";
  month: string;
  upstream?: CustomerReturnOriginMetadata;
};

/** Detects URLSearchParams-like readers while keeping setup parsing framework-agnostic. */
function isSearchParamReader(
  searchParams: ReturnOriginSearchParams,
): searchParams is SearchParamReader {
  return typeof (searchParams as Partial<SearchParamReader>).getAll === "function";
}

/** Checks whether a structured key was supplied, including duplicated values. */
function hasSearchParam(searchParams: ReturnOriginSearchParams, key: string) {
  if (isSearchParamReader(searchParams)) {
    return searchParams.getAll(key).length > 0;
  }

  return (searchParams as SearchParamRecord)[key] !== undefined;
}

/** Remaps the nested upstream keys into the shared return-origin parser contract. */
function upstreamSearchParams(
  searchParams: ReturnOriginSearchParams,
): ReturnOriginSearchParams {
  if (isSearchParamReader(searchParams)) {
    return {
      getAll(name: string) {
        if (name === "origin") return searchParams.getAll("upstream_origin");
        if (name === "month") return searchParams.getAll("upstream_month");
        return [];
      },
    };
  }

  const record = searchParams as SearchParamRecord;
  return {
    origin: record.upstream_origin,
    month: record.upstream_month,
  };
}

/** Accepts only a Monthly-editor setup detour and an optional validated customer upstream origin. */
export function parseSetupReturnOrigin(
  searchParams: ReturnOriginSearchParams,
): SetupReturnOrigin | null {
  const parsed = parseReturnOrigin(searchParams);
  if (parsed?.origin !== "monthly-editor") return null;

  const hasUpstreamOrigin = hasSearchParam(searchParams, "upstream_origin");
  const hasUpstreamMonth = hasSearchParam(searchParams, "upstream_month");
  if (!hasUpstreamOrigin && !hasUpstreamMonth) return parsed;
  if (!hasUpstreamOrigin) return null;

  const upstream = parseReturnOrigin(upstreamSearchParams(searchParams));
  if (
    !upstream ||
    (upstream.origin !== "customer-overview" &&
      upstream.origin !== "customer-profitability")
  ) {
    return null;
  }
  if (upstream.origin === "customer-overview" && hasUpstreamMonth) return null;

  return { ...parsed, upstream };
}
