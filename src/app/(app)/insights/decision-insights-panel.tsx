import type { DecisionInsightCandidate } from "@/lib/business/decision-insights";
import { MAX_DECISION_INSIGHTS } from "@/lib/business/insight-prioritization";
import styles from "./insights.module.css";

type DecisionInsightsPanelProps = {
  insights: readonly DecisionInsightCandidate[];
  fallbackMessageAr: string | null;
  currentMonthLabel: string;
  previousMonthLabel: string;
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
}: DecisionInsightsPanelProps) {
  const visibleInsights = insights.slice(0, MAX_DECISION_INSIGHTS);

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
          {visibleInsights.map((insight, index) => (
            <li key={insight.id} className={styles.insightCard} data-severity={insight.severity}>
              <div className={styles.cardTopline}>
                <span className={styles.rank} aria-hidden="true">{index + 1}</span>
                <span className={styles.severity}>{severityLabel[insight.severity]}</span>
                {insight.subjectName && <span className={styles.subject}>الفانل: {insight.subjectName}</span>}
              </div>
              <h3>{insight.titleAr}</h3>
              <p>{insight.messageAr}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.fallback} role="status">
          <strong>{fallbackMessageAr ?? "لا توجد ملاحظة حاسمة من القواعد الحالية"}</strong>
          <p>
            ميزان لا يحول البيانات المفقودة إلى صفر ولا يخترع تفسيرًا عند غياب الأدلة اللازمة.
          </p>
        </div>
      )}

      <p className={styles.definitionNote}>
        Ultimate CAC في ميزان يعني <strong>التكلفة الكاملة للبزنس لكل عميل جديد</strong>، وليس CAC التقليدي.
      </p>
    </section>
  );
}
