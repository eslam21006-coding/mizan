import Link from "next/link";
import {
  formatArabicMonthLabel,
  type BusinessOverviewHealth,
} from "@/lib/business-overview";
import styles from "./business-overview-panel.module.css";

type BusinessOverviewPanelProps = {
  baseCurrency: string;
  timezone: string;
  revenueSourceCount: number;
  expenseItemCount: number;
  health: BusinessOverviewHealth;
};

/** Presents setup readiness, monthly status, and one deterministic next action for the business. */
export function BusinessOverviewPanel({
  baseCurrency,
  timezone,
  revenueSourceCount,
  expenseItemCount,
  health,
}: BusinessOverviewPanelProps) {
  if (health.dataLoadError) {
    return (
      <section className={styles.errorPanel} role="alert" aria-label="حالة إعداد البزنس">
        <strong>تعذر تحميل حالة إعداد البزنس</strong>
        <p>
          لم يعرض ميزان حالة جاهزية غير مؤكدة. جرّب تحديث الصفحة، وستظل مساحة البزنس والتنقل متاحة.
        </p>
      </section>
    );
  }

  const latestSavedLabel = health.latestSavedMonthKey
    ? formatArabicMonthLabel(health.latestSavedMonthKey)
    : null;

  return (
    <div className={styles.overviewStack}>
      <section className={styles.section} aria-labelledby="setup-health-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>جاهزية الإعداد</span>
            <h2 id="setup-health-title">هل البزنس جاهز للإدخال الشهري؟</h2>
          </div>
          <span
            className={
              health.revenueSourcesReady && health.expensesReady
                ? styles.readySummary
                : styles.needsSummary
            }
          >
            {health.revenueSourcesReady && health.expensesReady ? "الإعداد جاهز" : "الإعداد يحتاج إكمال"}
          </span>
        </div>

        <div className={styles.healthGrid}>
          <article className={styles.healthCard}>
            <span className={styles.cardLabel}>العملة الأساسية</span>
            <strong dir="ltr">{baseCurrency}</strong>
            <span className={styles.readyBadge}>جاهز</span>
          </article>

          <article className={styles.healthCard}>
            <span className={styles.cardLabel}>المنطقة الزمنية</span>
            <strong dir="ltr">{timezone}</strong>
            <span className={styles.readyBadge}>جاهز</span>
          </article>

          <article className={styles.healthCard}>
            <span className={styles.cardLabel}>مصادر الإيراد</span>
            <strong>{revenueSourceCount}</strong>
            <span className={health.revenueSourcesReady ? styles.readyBadge : styles.missingBadge}>
              {health.revenueSourcesReady ? "جاهز" : "يحتاج إعداد"}
            </span>
          </article>

          <article className={styles.healthCard}>
            <span className={styles.cardLabel}>هيكل المصروفات</span>
            <strong>{expenseItemCount}</strong>
            <span className={health.expensesReady ? styles.readyBadge : styles.missingBadge}>
              {health.expensesReady ? "جاهز" : "يحتاج إعداد"}
            </span>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="monthly-status-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>حالة الأرقام الشهرية</span>
            <h2 id="monthly-status-title">أين وصلت بيانات البزنس؟</h2>
          </div>
        </div>

        <div className={styles.monthlyStatus}>
          <div>
            <span className={styles.cardLabel}>الشهر الحالي</span>
            <strong>{health.currentMonthSaved ? "محفوظ" : "لم يُحفظ بعد"}</strong>
          </div>
          <div>
            <span className={styles.cardLabel}>آخر شهر محفوظ</span>
            <strong>{latestSavedLabel ?? "لا توجد شهور محفوظة بعد"}</strong>
          </div>
        </div>

        {health.nextAction && (
          <Link className={styles.primaryAction} href={health.nextAction.href}>
            {health.nextAction.label}
          </Link>
        )}
      </section>
    </div>
  );
}
