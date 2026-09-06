import { notFound } from "next/navigation";
import { DecisionInsightsPanel } from "@/app/(app)/insights/decision-insights-panel";
import type { DecisionInsightCandidate } from "@/lib/business/decision-insights";

const FIXTURE_INSIGHTS: readonly DecisionInsightCandidate[] = [
  {
    id: "unhealthy-growth",
    ruleId: "unhealthy_growth",
    severity: "critical",
    domain: "profitability",
    priority: 10,
    dedupeKey: "unhealthy_growth",
    titleAr: "النمو الحالي يضغط على الربح",
    messageAr: "التحصيل ارتفع بينما الربح الصافي الحقيقي انخفض مقارنة بالشهر السابق.",
    evidence: ["net_cash_collected", "real_net_profit"],
  },
  {
    id: "non-media-cost-pressure",
    ruleId: "non_media_cost_pressure",
    severity: "warning",
    domain: "acquisition_cost",
    priority: 30,
    dedupeKey: "non_media_cost_pressure",
    titleAr: "الضغط يأتي من تكاليف خارج الميديا",
    messageAr:
      "Media CAC ثابت بينما التكلفة الكاملة للبزنس لكل عميل جديد (Ultimate CAC) ارتفعت.",
    evidence: ["media_cac", "ultimate_cac"],
  },
  {
    id: "attendance-funnel-a",
    ruleId: "funnel_attendance_bottleneck",
    severity: "warning",
    domain: "funnel",
    priority: 40,
    dedupeKey: "funnel_attendance_bottleneck:funnel-a",
    titleAr: "الحضور هو الاختناق الأوضح في الفانل",
    messageAr: "Show Rate أقل من 65% بينما Close Rate أعلى من 20%.",
    evidence: ["show_rate", "close_rate"],
    subjectId: "funnel-a",
    subjectName: "فانل المكالمات",
  },
] as const;

type DecisionInsightsFixtureProps = {
  searchParams: Promise<{ state?: string }>;
};

/** CI-only fixture for deterministic insight cards and the insufficient-data state. */
export default async function DecisionInsightsE2eFixturePage({
  searchParams,
}: DecisionInsightsFixtureProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();
  const query = await searchParams;
  const empty = query.state === "insufficient";

  return (
    <main className="page-stack">
      <DecisionInsightsPanel
        insights={empty ? [] : FIXTURE_INSIGHTS}
        fallbackMessageAr={empty ? "البيانات غير كافية للحكم" : null}
        currentMonthLabel="سبتمبر ٢٠٢٦"
        previousMonthLabel="أغسطس ٢٠٢٦"
      />
    </main>
  );
}
