import {
  DECISION_INSIGHT_RULE_IDS,
  type DecisionInsightRuleId,
} from "./business/decision-insights.ts";
import type { NavigationDestination } from "./navigation-hierarchy";

type SearchParamValue = string | string[] | undefined;

type SearchParamReader = {
  getAll(name: string): string[];
};

export type ReturnOriginSearchParams =
  | Readonly<Record<string, SearchParamValue>>
  | SearchParamReader;

export type CustomerReturnOriginMetadata =
  | { origin: "customer-overview" }
  | { origin: "customer-profitability"; month?: string };

export type InsightReturnOriginMetadata = {
  origin: "insights";
  month: string;
  ruleId: DecisionInsightRuleId;
  subjectId?: string;
};

export type ExternalReturnOriginMetadata =
  | CustomerReturnOriginMetadata
  | InsightReturnOriginMetadata;

export type ReturnOriginMetadata =
  | ExternalReturnOriginMetadata
  | { origin: "funnel-structure" }
  | {
      origin: "monthly-editor";
      month: string;
      upstream?: ExternalReturnOriginMetadata;
    };

export type ReturnOriginContext = {
  businessId: string;
};

type SingleSearchParam =
  | { status: "missing" }
  | { status: "value"; value: string }
  | { status: "ambiguous" };

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const SUBJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DECISION_INSIGHT_RULE_SET = new Set<string>(DECISION_INSIGHT_RULE_IDS);
const SUBJECT_RULES = new Set<DecisionInsightRuleId>([
  "healthy_funnel_weak_lifetime",
  "funnel_attendance_bottleneck",
]);

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
  const insightRuleParam = readSingleSearchParam(searchParams, "insight_rule");
  const insightSubjectParam = readSingleSearchParam(searchParams, "insight_subject");

  if (
    originParam.status !== "value" ||
    monthParam.status === "ambiguous" ||
    insightRuleParam.status === "ambiguous" ||
    insightSubjectParam.status === "ambiguous"
  ) {
    return null;
  }

  const month = monthParam.status === "value" ? monthParam.value : undefined;
  if (month !== undefined && (month.length !== 7 || !MONTH_KEY_PATTERN.test(month))) {
    return null;
  }

  switch (originParam.value) {
    case "customer-overview":
      return { origin: "customer-overview" };
    case "customer-profitability":
      return month
        ? { origin: "customer-profitability", month }
        : { origin: "customer-profitability" };
    case "monthly-editor":
      return month ? { origin: "monthly-editor", month } : null;
    case "funnel-structure":
      return { origin: "funnel-structure" };
    case "insights": {
      if (!month || insightRuleParam.status !== "value") return null;
      if (!DECISION_INSIGHT_RULE_SET.has(insightRuleParam.value)) return null;

      const ruleId = insightRuleParam.value as DecisionInsightRuleId;
      const subjectId =
        insightSubjectParam.status === "value" ? insightSubjectParam.value : undefined;
      const subjectExpected = SUBJECT_RULES.has(ruleId);

      if (subjectExpected !== Boolean(subjectId)) return null;
      if (subjectId && !SUBJECT_ID_PATTERN.test(subjectId)) return null;

      return {
        origin: "insights",
        month,
        ruleId,
        ...(subjectId ? { subjectId } : {}),
      };
    }
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
    case "funnel-structure":
      return { route: "business-funnels", businessId: context.businessId };
    case "insights":
      return {
        route: "insights",
        businessId: context.businessId,
        month: origin.month,
        insightId: `${origin.ruleId}${origin.subjectId ? `:${origin.subjectId}` : ""}`,
      };
    case "monthly-editor":
      return {
        route: "business-monthly",
        businessId: context.businessId,
        month: origin.month,
        origin: origin.upstream?.origin,
        returnMonth:
          origin.upstream?.origin === "customer-profitability" ||
          origin.upstream?.origin === "insights"
            ? origin.upstream.month
            : undefined,
        insightRuleId:
          origin.upstream?.origin === "insights" ? origin.upstream.ruleId : undefined,
        insightSubjectId:
          origin.upstream?.origin === "insights" ? origin.upstream.subjectId : undefined,
      };
  }
}
