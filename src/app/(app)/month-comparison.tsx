import type {
  CalculatedMetric,
  CoreCalculationResult,
  ExactRatio,
} from "@/lib/business/calculations";
import {
  compareCountMetrics,
  compareDecimalMetrics,
  compareRatioMetrics,
  type MetricComparison,
} from "@/lib/business/comparison";
import {
  formatArabicExactDecimal,
  formatArabicExactPercent,
  formatArabicExactRatio,
} from "@/lib/business/format-exact";
import dashboardStyles from "./dashboard.module.css";
import comparisonStyles from "./month-comparison.module.css";

function absoluteRatio(value: ExactRatio): ExactRatio {
  const numerator = BigInt(value.numerator);
  return {
    numerator: (numerator < 0n ? -numerator : numerator).toString(),
    denominator: value.denominator,
  };
}

function decimalText(metric: CalculatedMetric<string>, currency: string) {
  if (!metric.available) return "غير متاح";
  return `${formatArabicExactDecimal(metric.value, 2)} ${currency}`;
}

function countText(metric: CalculatedMetric<number>) {
  if (!metric.available) return "غير متاح";
  return formatArabicExactRatio(
    { numerator: String(metric.value), denominator: "1" },
    0,
  );
}

function ratioText(
  metric: CalculatedMetric<ExactRatio>,
  kind: "money" | "percent",
  currency: string,
) {
  if (!metric.available) return "غير متاح";
  return kind === "percent"
    ? `${formatArabicExactPercent(metric.value, 1)}%`
    : `${formatArabicExactRatio(metric.value, 2)} ${currency}`;
}

function comparisonText(
  comparison: MetricComparison,
  kind: "money" | "count" | "percentage-point",
  currency: string,
) {
  if (!comparison.available) {
    return comparison.reason === "CURRENT_UNAVAILABLE"
      ? "لا يمكن المقارنة: قيمة الشهر الحالي غير متاحة"
      : "لا يمكن المقارنة: قيمة الشهر السابق غير متاحة";
  }

  if (comparison.direction === "flat") return "بدون تغيير";

  const arrow = comparison.direction === "up" ? "↑" : "↓";
  const absoluteChange = absoluteRatio(comparison.change);

  let changeText: string;
  if (kind === "percentage-point") {
    changeText = `${arrow} ${formatArabicExactPercent(absoluteChange, 1)} نقطة مئوية`;
  } else if (kind === "money") {
    changeText = `${arrow} ${formatArabicExactRatio(absoluteChange, 2)} ${currency}`;
  } else {
    changeText = `${arrow} عدد العملاء بمقدار ${formatArabicExactRatio(absoluteChange, 0)}`;
  }

  if (comparison.relativeChange === null || kind === "percentage-point") return changeText;

  return `${changeText} (${formatArabicExactPercent(absoluteRatio(comparison.relativeChange), 1)}%)`;
}

type ComparisonCardProps = {
  label: string;
  current: string;
  previous: string;
  comparison: MetricComparison;
  kind: "money" | "count" | "percentage-point";
  currency: string;
};

function ComparisonCard({
  label,
  current,
  previous,
  comparison,
  kind,
  currency,
}: ComparisonCardProps) {
  return (
    <article className={comparisonStyles.comparisonCard}>
      <span className={comparisonStyles.comparisonLabel}>{label}</span>
      <dl className={comparisonStyles.comparisonValues}>
        <div>
          <dt>الحالي</dt>
          <dd>{current}</dd>
        </div>
        <div>
          <dt>السابق</dt>
          <dd>{previous}</dd>
        </div>
      </dl>
      <strong
        className={comparisonStyles.comparisonChange}
        data-direction={comparison.available ? comparison.direction : "unavailable"}
      >
        {comparisonText(comparison, kind, currency)}
      </strong>
      {comparison.available &&
        comparison.relativeChange === null &&
        comparison.direction !== "flat" &&
        kind !== "percentage-point" && (
          <small>نسبة التغير غير متاحة لأن قيمة الشهر السابق تساوي صفرًا.</small>
        )}
    </article>
  );
}

export function MonthComparison({
  current,
  previous,
  currency,
  currentMonthLabel,
  previousMonthLabel,
}: {
  current: CoreCalculationResult;
  previous: CoreCalculationResult;
  currency: string;
  currentMonthLabel: string;
  previousMonthLabel: string;
}) {
  const cards: ComparisonCardProps[] = [
    {
      label: "هامش صافي الربح الحقيقي",
      current: ratioText(current.realNetProfitMargin, "percent", currency),
      previous: ratioText(previous.realNetProfitMargin, "percent", currency),
      comparison: compareRatioMetrics(current.realNetProfitMargin, previous.realNetProfitMargin),
      kind: "percentage-point",
      currency,
    },
    {
      label: "صافي الربح الحقيقي",
      current: decimalText(current.realNetProfit, currency),
      previous: decimalText(previous.realNetProfit, currency),
      comparison: compareDecimalMetrics(current.realNetProfit, previous.realNetProfit),
      kind: "money",
      currency,
    },
    {
      label: "Ultimate CAC",
      current: ratioText(current.ultimateCac, "money", currency),
      previous: ratioText(previous.ultimateCac, "money", currency),
      comparison: compareRatioMetrics(current.ultimateCac, previous.ultimateCac),
      kind: "money",
      currency,
    },
    {
      label: "صافي الكاش المحصل",
      current: decimalText(current.netCashCollected, currency),
      previous: decimalText(previous.netCashCollected, currency),
      comparison: compareDecimalMetrics(current.netCashCollected, previous.netCashCollected),
      kind: "money",
      currency,
    },
    {
      label: "Acquisition CAC",
      current: ratioText(current.acquisitionCac, "money", currency),
      previous: ratioText(previous.acquisitionCac, "money", currency),
      comparison: compareRatioMetrics(current.acquisitionCac, previous.acquisitionCac),
      kind: "money",
      currency,
    },
    {
      label: "هامش المساهمة",
      current: ratioText(current.contributionMargin, "percent", currency),
      previous: ratioText(previous.contributionMargin, "percent", currency),
      comparison: compareRatioMetrics(current.contributionMargin, previous.contributionMargin),
      kind: "percentage-point",
      currency,
    },
    {
      label: "ربح المساهمة",
      current: decimalText(current.contributionProfit, currency),
      previous: decimalText(previous.contributionProfit, currency),
      comparison: compareDecimalMetrics(current.contributionProfit, previous.contributionProfit),
      kind: "money",
      currency,
    },
    {
      label: "العملاء الجدد",
      current: countText(current.newCustomers),
      previous: countText(previous.newCustomers),
      comparison: compareCountMetrics(current.newCustomers, previous.newCustomers),
      kind: "count",
      currency,
    },
    {
      label: "إجمالي العملاء الدافعين",
      current: countText(current.totalPayingCustomers),
      previous: countText(previous.totalPayingCustomers),
      comparison: compareCountMetrics(current.totalPayingCustomers, previous.totalPayingCustomers),
      kind: "count",
      currency,
    },
    {
      label: "الإيراد لكل عميل دافع",
      current: ratioText(current.revenuePerPayingCustomer, "money", currency),
      previous: ratioText(previous.revenuePerPayingCustomer, "money", currency),
      comparison: compareRatioMetrics(
        current.revenuePerPayingCustomer,
        previous.revenuePerPayingCustomer,
      ),
      kind: "money",
      currency,
    },
  ];

  return (
    <section className={dashboardStyles.sectionCard} aria-label="مقارنة الشهر بالشهر السابق">
      <div className={dashboardStyles.sectionHeading}>
        <div>
          <span className={dashboardStyles.eyebrow}>مقارنة شهرية</span>
          <h2>
            {currentMonthLabel} مقابل {previousMonthLabel}
          </h2>
        </div>
        <p>التغير محسوب من القيم الأصلية الدقيقة لكل شهر، وليس من أرقام العرض المقربة.</p>
      </div>
      <div className={comparisonStyles.comparisonGrid}>
        {cards.map((card) => (
          <ComparisonCard key={card.label} {...card} />
        ))}
      </div>
      <p className={dashboardStyles.definitionNote}>
        الأسهم تصف اتجاه الرقم فقط ولا تعني تلقائيًا أن التغير جيد أو سيئ. في النسب مثل هامش الربح
        وهامش المساهمة نعرض الفرق بالنقاط المئوية.
      </p>
    </section>
  );
}
