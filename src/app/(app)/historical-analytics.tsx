import type { CalculatedMetric, ExactRatio } from "@/lib/business/calculations";
import type { HistoricalAggregateResult } from "@/lib/business/historical-aggregation";
import type { HistoricalMonthResult } from "@/lib/business/dashboard-range";
import {
  formatArabicExactDecimal,
  formatArabicExactPercent,
  formatArabicExactRatio,
} from "@/lib/business/format-exact";
import dashboardStyles from "./dashboard.module.css";
import historyStyles from "./historical-analytics.module.css";

const CATEGORY_LABELS = {
  acquisition: "تكاليف الاستحواذ",
  fulfillment: "تكاليف التنفيذ والخدمة",
  overhead: "المصاريف العامة",
  financial: "التكاليف المالية",
} as const;

function moneyText(metric: CalculatedMetric<string>, currency: string) {
  return metric.available ? `${formatArabicExactDecimal(metric.value, 2)} ${currency}` : "غير متاح";
}

function percentText(metric: CalculatedMetric<ExactRatio>) {
  return metric.available ? `${formatArabicExactPercent(metric.value, 1)}%` : "غير متاح";
}

function countText(metric: CalculatedMetric<number>) {
  return metric.available
    ? formatArabicExactRatio({ numerator: String(metric.value), denominator: "1" }, 0)
    : "غير متاح";
}

function monthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthKey}-01T00:00:00.000Z`));
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <article className={dashboardStyles.metricCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <p>{note}</p>}
    </article>
  );
}

export function HistoricalAnalytics({
  aggregate,
  months,
  currency,
  periodLabel,
}: {
  aggregate: HistoricalAggregateResult;
  months: HistoricalMonthResult[];
  currency: string;
  periodLabel: string;
}) {
  return (
    <>
      <section className={dashboardStyles.sectionCard} aria-label="ملخص التحليل التاريخي">
        <div className={dashboardStyles.sectionHeading}>
          <div>
            <span className={dashboardStyles.eyebrow}>تحليل متعدد الأشهر</span>
            <h2>{periodLabel}</h2>
          </div>
          <p>القيم الإضافية جُمعت من الأشهر المحفوظة، ثم أُعيد حساب الهوامش من إجمالي البسط والمقام.</p>
        </div>

        <div className={dashboardStyles.primaryMetrics}>
          <MetricCard label="صافي الكاش المحصل" value={moneyText(aggregate.netCashCollected, currency)} />
          <MetricCard label="صافي الربح الحقيقي" value={moneyText(aggregate.realNetProfit, currency)} />
          <MetricCard label="هامش صافي الربح الحقيقي" value={percentText(aggregate.realNetProfitMargin)} />
          <MetricCard label="إجمالي تكاليف البزنس" value={moneyText(aggregate.allBusinessCosts, currency)} />
        </div>

        <div className={dashboardStyles.secondaryMetrics}>
          <MetricCard label="إجمالي الكاش المحصل" value={moneyText(aggregate.grossCashCollected, currency)} />
          <MetricCard label="المرتجعات" value={moneyText(aggregate.refunds, currency)} />
          <MetricCard label="ربح المساهمة" value={moneyText(aggregate.contributionProfit, currency)} />
          <MetricCard label="هامش المساهمة" value={percentText(aggregate.contributionMargin)} />
        </div>

        <div className={dashboardStyles.twoColumnGrid}>
          <div>
            <span className={dashboardStyles.eyebrow}>تفصيل التكاليف</span>
            <div className={dashboardStyles.expenseBreakdown}>
              {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
                <div key={category}>
                  <span>{label}</span>
                  <strong>
                    {moneyText(
                      aggregate.expensesByCategory[category as keyof typeof aggregate.expensesByCategory],
                      currency,
                    )}
                  </strong>
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className={dashboardStyles.eyebrow}>عدادات شهرية مجمعة</span>
            <div className={historyStyles.estimateGrid}>
              <div className={historyStyles.estimateCard}>
                <span>مجموع العملاء الجدد المسجلين شهريًا</span>
                <strong>{countText(aggregate.reportedNewCustomersSum)}</strong>
              </div>
              <div className={historyStyles.estimateCard}>
                <span>مجموع العملاء الدافعين المسجلين شهريًا</span>
                <strong>{countText(aggregate.reportedPayingCustomersSum)}</strong>
              </div>
            </div>
            <p className={dashboardStyles.boundaryNote}>
              هذه المجاميع ليست عددًا فريدًا للعملاء عبر الفترة. لذلك لا يعرض ميزان Ultimate CAC أو
              Acquisition CAC أو Revenue Per Customer كقيم دقيقة متعددة الأشهر اعتمادًا على الإدخال الشهري
              اليدوي فقط. يلزم تاريخ معاملات العملاء لإزالة التكرار بين الأشهر.
            </p>
          </div>
        </div>
      </section>

      <section className={dashboardStyles.sectionCard} aria-label="التفصيل الشهري للفترة">
        <div className={dashboardStyles.sectionHeading}>
          <div>
            <span className={dashboardStyles.eyebrow}>التاريخ الشهري</span>
            <h2>تفصيل الأشهر داخل الفترة</h2>
          </div>
          <p>يمكنك مراجعة كل شهر منفردًا بجانب النتيجة المجمعة دون تعديل أي بيانات تاريخية.</p>
        </div>
        <div className={historyStyles.historyGrid}>
          {months.map(({ monthKey, result }) => (
            <article className={historyStyles.historyCard} key={monthKey}>
              <h3>{monthLabel(monthKey)}</h3>
              <dl>
                <div>
                  <dt>صافي الكاش</dt>
                  <dd>{moneyText(result.netCashCollected, currency)}</dd>
                </div>
                <div>
                  <dt>صافي الربح</dt>
                  <dd>{moneyText(result.realNetProfit, currency)}</dd>
                </div>
                <div>
                  <dt>هامش الربح</dt>
                  <dd>{percentText(result.realNetProfitMargin)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
