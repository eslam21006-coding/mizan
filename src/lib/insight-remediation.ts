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

function monthlyHref(businessId: string, monthKey: string) {
  const query = new URLSearchParams({ month: monthKey });
  return `${businessPath(businessId)}/monthly?${query.toString()}`;
}

function customerProfitabilityHref(businessId: string, monthKey: string) {
  const query = new URLSearchParams({ view: "profitability", month: monthKey });
  return `${businessPath(businessId)}/customers?${query.toString()}`;
}

function funnelMonthlyHref(
  businessId: string,
  monthKey: string,
  subjectId?: string,
) {
  const query = new URLSearchParams({ month: monthKey });
  const fragment = subjectId ? `#funnel-${encodeURIComponent(subjectId)}` : "";
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
        href: monthlyHref(context.businessId, context.monthKey),
        labelAr: LABELS[insight.ruleId],
      };
    case "healthy_funnel_weak_lifetime":
    case "rising_cac_lifetime_supported":
      return {
        href: customerProfitabilityHref(context.businessId, context.monthKey),
        labelAr: LABELS[insight.ruleId],
      };
    case "funnel_attendance_bottleneck":
      return {
        href: funnelMonthlyHref(
          context.businessId,
          context.monthKey,
          insight.subjectId,
        ),
        labelAr: LABELS[insight.ruleId],
      };
  }
}
