import type {
  DecisionInsightCandidate,
  DecisionInsightRuleId,
} from "./business/decision-insights.ts";

export type InsightRemediation = {
  href: string;
  labelAr: string;
};

type InsightRemediationContext = {
  businessId: string;
  monthKey: string;
};

function businessPath(businessId: string) {
  return `/businesses/${encodeURIComponent(businessId)}`;
}

/** Adds the allow-listed Insights return metadata shared by every remediation destination. */
function appendInsightReturnParams(
  query: URLSearchParams,
  insight: Pick<DecisionInsightCandidate, "ruleId" | "subjectId">,
  monthKey: string,
) {
  query.set("origin", "insights");
  query.set("return_month", monthKey);
  query.set("insight_rule", insight.ruleId);
  if (insight.subjectId) query.set("insight_subject", insight.subjectId);
}

function monthlyHref(
  businessId: string,
  monthKey: string,
  insight: Pick<DecisionInsightCandidate, "ruleId" | "subjectId">,
) {
  const query = new URLSearchParams({ month: monthKey });
  appendInsightReturnParams(query, insight, monthKey);
  return `${businessPath(businessId)}/monthly?${query.toString()}`;
}

function customerProfitabilityHref(
  businessId: string,
  monthKey: string,
  insight: Pick<DecisionInsightCandidate, "ruleId" | "subjectId">,
) {
  const query = new URLSearchParams({ view: "profitability", month: monthKey });
  appendInsightReturnParams(query, insight, monthKey);
  return `${businessPath(businessId)}/customers?${query.toString()}`;
}

function funnelMonthlyHref(
  businessId: string,
  monthKey: string,
  insight: Pick<DecisionInsightCandidate, "ruleId" | "subjectId">,
) {
  const query = new URLSearchParams({ month: monthKey });
  appendInsightReturnParams(query, insight, monthKey);
  const fragment = insight.subjectId
    ? `#funnel-${encodeURIComponent(insight.subjectId)}`
    : "";
  return `${businessPath(businessId)}/funnels/monthly?${query.toString()}${fragment}`;
}

const LABELS: Record<DecisionInsightRuleId, string> = {
  unhealthy_growth: "مراجعة أرقام وتكاليف الشهر",
  healthy_funnel_weak_lifetime: "مراجعة ربحية العميل",
  non_media_cost_pressure: "مراجعة المصروفات خارج الميديا",
  funnel_attendance_bottleneck: "مراجعة أرقام الفانل",
  rising_cac_lifetime_supported: "مراجعة اقتصاديات العميل",
};

/** Resolves an insight to a known business-scoped source/fix without accepting arbitrary URLs. */
export function resolveInsightRemediation(
  insight: Pick<DecisionInsightCandidate, "ruleId" | "subjectId">,
  context: InsightRemediationContext,
): InsightRemediation {
  switch (insight.ruleId) {
    case "unhealthy_growth":
    case "non_media_cost_pressure":
      return {
        href: monthlyHref(context.businessId, context.monthKey, insight),
        labelAr: LABELS[insight.ruleId],
      };
    case "healthy_funnel_weak_lifetime":
    case "rising_cac_lifetime_supported":
      return {
        href: customerProfitabilityHref(context.businessId, context.monthKey, insight),
        labelAr: LABELS[insight.ruleId],
      };
    case "funnel_attendance_bottleneck":
      return {
        href: funnelMonthlyHref(context.businessId, context.monthKey, insight),
        labelAr: LABELS[insight.ruleId],
      };
  }
}
