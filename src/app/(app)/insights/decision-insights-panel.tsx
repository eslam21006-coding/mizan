import Link from "next/link";
import type { DecisionInsightCandidate } from "@/lib/business/decision-insights";
import { MAX_DECISION_INSIGHTS } from "@/lib/business/insight-prioritization";
import { resolveInsightRemediation } from "@/lib/insight-remediation";
import styles from "./insights.module.css";

type DecisionInsightsPanelProps = {
  insights: readonly DecisionInsightCandidate[];
  fallbackMessageAr: string | null;
  currentMonthLabel: string;
  previousMonthLabel: string;
  businessId: string;
  currentMonthKey: string;
  customerEconomicsEvidenceQuality?: "actual" | "estimated" | null;
};

const severityLabel = {
  critical: "حرج",
  warning: "يحتاج انتباه",
  context: "سياق مهم",
} as const;

/** Presents the already-prioritized deterministic Decision Engine output without adding new claims. */
export function DecisionInsightsPanel({
  insights,
  fallbackMessageAr,
  currentMonthLabel,
  previousMonthLabel,
  businessId,
  currentMonthKey,
  customerEconomicsEvidenceQuality = null,
}: DecisionInsightsPanelProps) {
  const visibleInsights = insights.slice(0, MAX_DECISION_INSIGHTS);
  const showsCustomerEconomicsInsight = visibleInsights.some(
    (insight) => insight.domain === "customer_economics",
  );

  return (
    <section className={styles.panel} aria-labelledby="decision-insights-title">
      <div className={styles.headingRow}>
        <div>
          <span className={styles.kicker}>Decision Engine</span>
          <h2 id="decision-insights-title">أهم 3 ملاحظات</h2>
          <p>
            قواعد حتمية من البيانات الفعلية: {currentMonthLabel} مقابل {previousMonthLabel}. لا توجد
            استنتاجات مولدة أو أرقام مفترضة.
          </p>
        </div>
        <span className={styles.countBadge}>{visibleInsights.length} / {MAX_DECISION_INSIGHTS}</span>
      </div>

      {visibleInsights.length > 0 ? (
        <ol className={styles.insightList}>
          {visibleInsights.map((insight, index) => {
            const remediation =
              insight.ruleId === "healthy_funnel_weak_lifetime" ||
              insight.ruleId === "funnel_attendance_bottleneck"
                ? insight.subjectId
                  ? resolveInsightRemediation(
                      { ruleId: insight.ruleId, subjectId: insight.subjectId },
                      { businessId, monthKey: currentMonthKey },
                    )
                  : null
                : resolveInsightRemediation(
                    { ruleId: insight.ruleId },
                    { businessId, monthKey: currentMonthKey },
                  );

            return (
              <li
                key={insight.id}
                id={`insight-${insight.id}`}
                className={styles.insightCard}
                data-severity={insight.severity}
              >
                <div className={styles.cardTopline}>
                  <span className={styles.rank} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.severity}>{severityLabel[insight.severity]}</span>
                  {insight.subjectName && (
                    <span className={styles.subject}>الفانل: {insight.subjectName}</span>
                  )}
                </div>
                <h3>{insight.titleAr}</h3>
                <p>{insight.messageAr}</p>
                {remediation && (
                  <Link className={styles.remediationAction} href={remediation.href}>
                    {remediation.labelAr}
                    <span aria-hidden="true">←</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={styles.fallback} role="status">
          <strong>{fallbackMessageAr ?? "لا توجد ملاحظة حاسمة من القواعد الحالية"}</strong>
          <p>
            هذا قد يكون طبيعيًا إذا لم ترَ القواعد الحالية مشكلة حاسمة، أو قد يعني أن الأدلة غير
            كافية. ميزان لا يحول البيانات المفقودة إلى صفر ولا يخترع تفسيرًا.
          </p>
          <Link
            className={styles.fallbackAction}
            href={`/analytics?business=${encodeURIComponent(businessId)}&month=${encodeURIComponent(currentMonthKey)}`}
          >
            مراجعة التحليلات
          </Link>
        </div>
      )}

      {showsCustomerEconomicsInsight && customerEconomicsEvidenceQuality === "estimated" && (
        <p className={styles.definitionNote} role="note">
          ملاحظة اقتصاديات العميل تعتمد على كاش محصل فعلي، لكن بعض التكاليف المرتبطة بالعملاء موزعة
          تقديريًا بقواعد ميزان الحتمية. راجع تفاصيل الربحية لمعرفة أساس التوزيع.
        </p>
      )}

      <p className={styles.definitionNote}>
        Ultimate CAC في ميزان يعني <strong>التكلفة الكاملة للبزنس لكل عميل جديد</strong>، وليس CAC التقليدي.
      </p>
    </section>
  );
}
