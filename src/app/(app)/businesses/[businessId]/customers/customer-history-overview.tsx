import styles from "./customer-history-overview.module.css";

export type CustomerHistoryOverviewSummary = {
  payingCustomerCountText: string;
  repeatCustomerCountText: string;
  netCashCollectedText: string;
  revenuePerPayingCustomerText: string | null;
};

type CustomerHistoryOverviewProps = {
  baseCurrency: string;
  summary: CustomerHistoryOverviewSummary | null;
  loadError?: boolean;
};

/** Presents exact business-level customer-history facts without relabeling period revenue as LTV. */
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
            <span className={styles.kicker}>ملخص سجل العملاء</span>
            <h2 id="customer-history-overview-title">ماذا يقول تاريخ معاملاتك؟</h2>
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
            <span className={styles.kicker}>ملخص سجل العملاء</span>
            <h2 id="customer-history-overview-title">ماذا يقول تاريخ معاملاتك؟</h2>
          </div>
        </div>
        <div className={styles.emptyState}>
          <strong>لا توجد بيانات معاملات كافية بعد</strong>
          <p>بعد استيراد أول معاملات محفوظة سيظهر هنا ملخص بسيط قبل الدخول إلى الكوهورتات والتحليلات التفصيلية.</p>
        </div>
      </section>
    );
  }

  const money = (value: string) => `${value} ${baseCurrency}`;
  const revenuePerPayingCustomer = summary.revenuePerPayingCustomerText
    ? money(summary.revenuePerPayingCustomerText)
    : "غير متاح";

  return (
    <section className={styles.shell} aria-labelledby="customer-history-overview-title">
      <div className={styles.heading}>
        <div>
          <span className={styles.kicker}>ملخص سجل العملاء</span>
          <h2 id="customer-history-overview-title">ماذا يقول تاريخ معاملاتك؟</h2>
          <p>أرقام مباشرة من سجل المعاملات المحفوظ، قبل الدخول إلى الكوهورتات والتحليلات الأعمق.</p>
        </div>
      </div>

      <div className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <span>العملاء المكتسبون</span>
          <strong>{summary.payingCustomerCountText}</strong>
          <small>لديهم تحصيل ناجح واحد على الأقل</small>
        </article>

        <article className={styles.metricCard}>
          <span>صافي التحصيل التاريخي</span>
          <strong dir="ltr">{money(summary.netCashCollectedText)}</strong>
          <small>كل التحصيلات − الاسترجاعات</small>
        </article>

        <article className={styles.metricCard}>
          <span>العملاء المتكررون</span>
          <strong>{summary.repeatCustomerCountText}</strong>
          <small>أكثر من تحصيل ناجح لنفس العميل</small>
        </article>

        <article className={styles.metricCard}>
          <span>صافي التحصيل لكل عميل دافع</span>
          <strong dir="ltr">{revenuePerPayingCustomer}</strong>
          <small>Net Cash ÷ العملاء الدافعين · هذا ليس LTV</small>
        </article>
      </div>

      <p className={styles.ltvNote}>
        <strong>Observed LTV / قيمة العميل المحققة حتى الآن</strong> يظل محسوبًا لكل كوهورت في التحليل أدناه؛ ميزان لا يصنع رقم LTV واحدًا للبزنس من هذا الملخص.
      </p>
    </section>
  );
}
