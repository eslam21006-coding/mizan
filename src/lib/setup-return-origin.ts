import {
  parseReturnOrigin,
  type ExternalReturnOriginMetadata,
  type ReturnOriginSearchParams,
} from "./return-origin.ts";

type SearchParamRecord = Readonly<Record<string, string | string[] | undefined>>;
type SearchParamReader = {
  getAll(name: string): string[];
};

export type SetupReturnOrigin = {
  origin: "monthly-editor";
  month: string;
  upstream?: ExternalReturnOriginMetadata;
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
        if (name === "insight_rule") return searchParams.getAll("upstream_insight_rule");
        if (name === "insight_subject") return searchParams.getAll("upstream_insight_subject");
        return [];
      },
    };
  }

  const record = searchParams as SearchParamRecord;
  return {
    origin: record.upstream_origin,
    month: record.upstream_month,
    insight_rule: record.upstream_insight_rule,
    insight_subject: record.upstream_insight_subject,
  };
}

/** Accepts a Monthly-editor setup detour with an optional validated customer or Insights upstream origin. */
export function parseSetupReturnOrigin(
  searchParams: ReturnOriginSearchParams,
): SetupReturnOrigin | null {
  const parsed = parseReturnOrigin(searchParams);
  if (parsed?.origin !== "monthly-editor") return null;

  const hasUpstreamOrigin = hasSearchParam(searchParams, "upstream_origin");
  const hasUpstreamMonth = hasSearchParam(searchParams, "upstream_month");
  const hasUpstreamInsightRule = hasSearchParam(searchParams, "upstream_insight_rule");
  const hasUpstreamInsightSubject = hasSearchParam(searchParams, "upstream_insight_subject");
  if (
    !hasUpstreamOrigin &&
    !hasUpstreamMonth &&
    !hasUpstreamInsightRule &&
    !hasUpstreamInsightSubject
  ) {
    return parsed;
  }
  if (!hasUpstreamOrigin) return null;

  const upstream = parseReturnOrigin(upstreamSearchParams(searchParams));
  if (
    !upstream ||
    (upstream.origin !== "customer-overview" &&
      upstream.origin !== "customer-profitability" &&
      upstream.origin !== "insights")
  ) {
    return null;
  }

  if (
    upstream.origin === "customer-overview" &&
    (hasUpstreamMonth || hasUpstreamInsightRule || hasUpstreamInsightSubject)
  ) {
    return null;
  }

  if (
    upstream.origin === "customer-profitability" &&
    (hasUpstreamInsightRule || hasUpstreamInsightSubject)
  ) {
    return null;
  }

  return { ...parsed, upstream };
}
