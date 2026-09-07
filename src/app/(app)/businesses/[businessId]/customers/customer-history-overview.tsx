import type { CustomerHistoryOverviewSummary } from "@/lib/business/customer-history-overview";
import {
  formatCountRatioPercent,
  formatCountText,
  formatMoneyText,
} from "@/lib/financial-display";
import styles from "./customer-history-overview.module.css";

type CustomerHistoryOverviewProps = {
  baseCurrency: string;
  summary: CustomerHistoryOverviewSummary | null;
  loadError?: boolean;
};

/** Presents business-level customer-history facts in a compact founder-facing summary. */
export function CustomerHistoryOverview({
  baseCurrency,
  summary,
  loadError = false,
}: CustomerHistoryOverviewProps) {
  if (loadError) {
    return (
      <section className={styles.shell} aria-labelledby="customer-history-overview-title">
        <div className={styles.heading}>
          <div>
            <span className={styles.kicker}>نظرة عامة</span>
            <h2 id="customer-history-overview-title">ملخص العملاء</h2>
          </div>
        </div>
        <div className={styles.errorState} role="alert">
          <strong>تعذر تحميل ملخص سجل العملاء</strong>
          <p>لن يعرض ميزان أرقامًا بديلة أو يحول البيانات المفقودة إلى صفر. أعد تحميل الصفحة للمحاولة مرة أخرى.</p>
        </div>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className={styles.shell} aria-labelledby="customer-history-overview-title">
        <div className={styles.heading}>
          <div>
            <span className={styles.kicker}>نظرة عامة</span>
            <h2 id="customer-history-overview-title">ملخص العملاء</h2>
          </div>
        </div>
        <div className={styles.emptyState}>
          <strong>لا توجد بيانات معاملات كافية بعد</strong>
          <p>بعد استيراد أول معاملات محفوظة سيظهر هنا عدد العملاء وصافي التحصيل وتكرار الشراء.</p>
        </div>
      </section>
    );
  }

  const revenuePerPayingCustomer = summary.revenuePerPayingCustomerText
    ? formatMoneyText(summary.revenuePerPayingCustomerText, baseCurrency)
    : "غير متاح";
  const repeatRate = formatCountRatioPercent(
    summary.repeatCustomerCountText,
    summary.payingCustomerCountText,
  );

  return (
    <section className={styles.shell} aria-labelledby="customer-history-overview-title">
      <div className={styles.heading}>
        <div>
          <span className={styles.kicker}>نظرة عامة</span>
          <h2 id="customer-history-overview-title">ملخص العملاء</h2>
          <p>أهم ما تحتاج معرفته من سجل المعاملات قبل الدخول في التحليل التفصيلي.</p>
        </div>
      </div>

      <div className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <span>العملاء المكتسبون</span>
          <strong dir="ltr">{formatCountText(summary.payingCustomerCountText)}</strong>
          <small>لديهم تحصيل ناجح واحد على الأقل</small>
        </article>

        <article className={styles.metricCard}>
          <span>صافي التحصيل</span>
          <strong dir="ltr">{formatMoneyText(summary.netCashCollectedText, baseCurrency)}</strong>
          <small>كل التحصيلات − الاسترجاعات</small>
        </article>

        <article className={styles.metricCard}>
          <span>العملاء المتكررون</span>
          <strong dir="ltr">{formatCountText(summary.repeatCustomerCountText)}</strong>
          <small>اشتروا أكثر من مرة</small>
        </article>

        <article className={styles.metricCard}>
          <span>متوسط صافي التحصيل لكل عميل</span>
          <strong dir="ltr">{revenuePerPayingCustomer}</strong>
          <small>Net Cash ÷ العملاء الدافعين · ليس LTV</small>
        </article>
      </div>

      {repeatRate && (
        <div className={styles.insight} role="note">
          <strong dir="ltr">{repeatRate}</strong>
          <span>من عملائك اشتروا أكثر من مرة.</span>
        </div>
      )}

      <p className={styles.ltvNote}>
        <strong>Observed LTV / قيمة العميل المحققة حتى الآن</strong> يُحسب لكل كوهورت في التحليل أدناه، وليس من متوسط صافي التحصيل لكل عميل.
      </p>
    </section>
  );
}
