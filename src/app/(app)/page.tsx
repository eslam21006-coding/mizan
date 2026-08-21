import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import type {
  CalculatedMetric,
  CalculationUnavailableReason,
  CoreCalculationResult,
  ExactRatio,
} from "@/lib/business/calculations";
import { loadDashboardMonth } from "@/lib/business/dashboard-month";
import { currentMonthKeyForTimeZone, parseMonthKey } from "@/lib/business/monthly";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./dashboard.module.css";

type HomePageProps = {
  searchParams: Promise<{ business?: string; month?: string }>;
};

type BusinessRow = {
  id: string;
  name: string;
  base_currency: string;
  timezone: string;
};

const UNAVAILABLE_LABELS: Record<CalculationUnavailableReason, string> = {
  INPUT_UNAVAILABLE: "بيانات غير مكتملة",
  NO_NEW_CUSTOMERS: "لا يوجد عملاء جدد",
  NO_PAYING_CUSTOMERS: "لا يوجد عملاء دافعون",
  NON_POSITIVE_NET_CASH: "صافي التحصيل غير موجب",
  NO_AD_SPEND: "لا يوجد إنفاق إعلاني",
  ATTRIBUTION_UNAVAILABLE: "بيانات الإسناد غير متاحة",
};

const numberFormatter = new Intl.NumberFormat("ar-EG", {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("ar-EG", {
  maximumFractionDigits: 1,
});

function formattedDecimal(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? numberFormatter.format(number) : value;
}

function formattedMoney(metric: CalculatedMetric<string>, currency: string) {
  return metric.available
    ? { value: `${formattedDecimal(metric.value)} ${currency}`, unavailable: false as const }
    : { value: UNAVAILABLE_LABELS[metric.reason], unavailable: true as const };
}

function formattedCount(metric: CalculatedMetric<number>) {
  return metric.available
    ? { value: numberFormatter.format(metric.value), unavailable: false as const }
    : { value: UNAVAILABLE_LABELS[metric.reason], unavailable: true as const };
}

function ratioNumber(ratio: ExactRatio) {
  const numerator = Number(ratio.numerator);
  const denominator = Number(ratio.denominator);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function formattedRatio(
  metric: CalculatedMetric<ExactRatio>,
  kind: "percent" | "money",
  currency: string,
) {
  if (!metric.available) {
    return { value: UNAVAILABLE_LABELS[metric.reason], unavailable: true as const };
  }

  const number = ratioNumber(metric.value);
  if (number === null) {
    return {
      value: `${metric.value.numerator}/${metric.value.denominator}`,
      unavailable: false as const,
    };
  }

  return {
    value:
      kind === "percent"
        ? `${percentFormatter.format(number * 100)}%`
        : `${numberFormatter.format(number)} ${currency}`,
    unavailable: false as const,
  };
}

function formattedMultiple(metric: CalculatedMetric<ExactRatio>) {
  if (!metric.available) {
    return { value: UNAVAILABLE_LABELS[metric.reason], unavailable: true as const };
  }

  const number = ratioNumber(metric.value);
  return {
    value: number === null ? `${metric.value.numerator}/${metric.value.denominator}` : `${numberFormatter.format(number)}×`,
    unavailable: false as const,
  };
}

function MetricCard({
  label,
  value,
  note,
  featured = false,
  unavailable = false,
}: {
  label: string;
  value: string;
  note?: string;
  featured?: boolean;
  unavailable?: boolean;
}) {
  return (
    <article className={`${styles.metricCard} ${featured ? styles.featuredMetric : ""}`}>
      <span>{label}</span>
      <strong className={unavailable ? styles.unavailableValue : undefined}>{value}</strong>
      {note && <p>{note}</p>}
    </article>
  );
}

function EmptyDashboard({ business, monthKey }: { business: BusinessRow; monthKey: string }) {
  return (
    <section className={styles.emptyState}>
      <span className={styles.eyebrow}>لا توجد أرقام محفوظة</span>
      <h2>ابدأ بإدخال بيانات هذا الشهر</h2>
      <p>
        الداشبورد يعرض الأرقام الفعلية المحفوظة فقط. لن نفترض إيرادًا أو مصروفًا أو عدد عملاء غير
        موجود في البيانات.
      </p>
      <Link
        className={styles.primaryAction}
        href={`/businesses/${business.id}/monthly?month=${monthKey}`}
      >
        إدخال أرقام الشهر
      </Link>
    </section>
  );
}

function DashboardMetrics({ result, currency }: { result: CoreCalculationResult; currency: string }) {
  const margin = formattedRatio(result.realNetProfitMargin, "percent", currency);
  const profit = formattedMoney(result.realNetProfit, currency);
  const ultimateCac = formattedRatio(result.ultimateCac, "money", currency);
  const netCash = formattedMoney(result.netCashCollected, currency);
  const acquisitionCac = formattedRatio(result.acquisitionCac, "money", currency);
  const mediaCac = formattedRatio(result.mediaCac, "money", currency);
  const mer = formattedMultiple(result.mer);
  const contributionMargin = formattedRatio(result.contributionMargin, "percent", currency);
  const contributionProfit = formattedMoney(result.contributionProfit, currency);
  const allCosts = formattedMoney(result.allBusinessCosts, currency);
  const grossCash = formattedMoney(result.grossCashCollected, currency);
  const refunds = formattedMoney(result.refunds, currency);
  const revenuePerPaying = formattedRatio(result.revenuePerPayingCustomer, "money", currency);
  const revenuePerNew = formattedRatio(result.revenuePerNewCustomer, "money", currency);
  const newCustomers = formattedCount(result.newCustomers);
  const payingCustomers = formattedCount(result.totalPayingCustomers);
  const returningCustomers = formattedCount(result.returningCustomers);

  const expenseRows = [
    ["تكاليف الاكتساب", result.expensesByCategory.acquisition],
    ["تكاليف التنفيذ وخدمة العملاء", result.expensesByCategory.fulfillment],
    ["المصاريف التشغيلية العامة", result.expensesByCategory.overhead],
    ["المصاريف المالية", result.expensesByCategory.financial],
  ] as const;

  return (
    <>
      <section className={styles.primaryMetrics} aria-label="المؤشرات المالية الأساسية">
        <MetricCard
          featured
          label="هامش صافي الربح الحقيقي"
          value={margin.value}
          unavailable={margin.unavailable}
          note="صافي الربح الحقيقي ÷ صافي الكاش المحصل"
        />
        <MetricCard
          featured
          label="صافي الربح الحقيقي"
          value={profit.value}
          unavailable={profit.unavailable}
          note="بعد كل تكاليف البزنس"
        />
        <MetricCard
          featured
          label="Ultimate CAC"
          value={ultimateCac.value}
          unavailable={ultimateCac.unavailable}
          note="التكلفة الكاملة للبزنس لكل عميل جديد — مقياس ميزان وليس CAC التقليدي"
        />
        <MetricCard
          featured
          label="صافي الكاش المحصل"
          value={netCash.value}
          unavailable={netCash.unavailable}
          note="الإيراد المحصل فعليًا بعد المرتجعات"
        />
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>اقتصاديات الشهر</span>
            <h2>الربحية والتكلفة</h2>
          </div>
          <p>كل القيم هنا ناتجة مباشرة من محرك الحساب المركزي.</p>
        </div>
        <div className={styles.secondaryMetrics}>
          <MetricCard
            label="Acquisition CAC"
            value={acquisitionCac.value}
            unavailable={acquisitionCac.unavailable}
            note="كل تكاليف الاكتساب والمبيعات والتسويق ÷ العملاء الجدد"
          />
          <MetricCard
            label="Media CAC"
            value={mediaCac.value}
            unavailable={mediaCac.unavailable}
            note="إجمالي الإنفاق الإعلاني المعتمد ÷ العملاء الجدد"
          />
          <MetricCard
            label="MER"
            value={mer.value}
            unavailable={mer.unavailable}
            note="صافي الكاش المحصل ÷ إجمالي الإنفاق الإعلاني المعتمد"
          />
          <MetricCard
            label="هامش المساهمة"
            value={contributionMargin.value}
            unavailable={contributionMargin.unavailable}
          />
          <MetricCard
            label="ربح المساهمة"
            value={contributionProfit.value}
            unavailable={contributionProfit.unavailable}
          />
          <MetricCard
            label="إجمالي تكاليف البزنس"
            value={allCosts.value}
            unavailable={allCosts.unavailable}
          />
        </div>
      </section>

      <div className={styles.twoColumnGrid}>
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>الكاش والعملاء</span>
              <h2>جودة الإيراد وحجم قاعدة العملاء</h2>
            </div>
          </div>
          <dl className={styles.detailList}>
            <div>
              <dt>إجمالي الكاش المحصل قبل المرتجعات</dt>
              <dd className={grossCash.unavailable ? styles.unavailableValue : undefined}>
                {grossCash.value}
              </dd>
            </div>
            <div>
              <dt>المرتجعات</dt>
              <dd className={refunds.unavailable ? styles.unavailableValue : undefined}>{refunds.value}</dd>
            </div>
            <div>
              <dt>العملاء الجدد</dt>
              <dd className={newCustomers.unavailable ? styles.unavailableValue : undefined}>
                {newCustomers.value}
              </dd>
            </div>
            <div>
              <dt>إجمالي العملاء الدافعين</dt>
              <dd className={payingCustomers.unavailable ? styles.unavailableValue : undefined}>
                {payingCustomers.value}
              </dd>
            </div>
            <div>
              <dt>العملاء العائدون</dt>
              <dd className={returningCustomers.unavailable ? styles.unavailableValue : undefined}>
                {returningCustomers.value}
              </dd>
            </div>
            <div>
              <dt>الإيراد لكل عميل دافع</dt>
              <dd className={revenuePerPaying.unavailable ? styles.unavailableValue : undefined}>
                {revenuePerPaying.value}
              </dd>
            </div>
            <div>
              <dt>الإيراد لكل عميل جديد</dt>
              <dd className={revenuePerNew.unavailable ? styles.unavailableValue : undefined}>
                {revenuePerNew.value}
              </dd>
            </div>
          </dl>
          <p className={styles.definitionNote}>
            القيمتان الأخيرتان مؤشرا إيراد لكل عميل وليستا LTV. قيمة العميل الحقيقية ستأتي من
            تاريخ المعاملات في مرحلة LTV.
          </p>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>هيكل التكلفة</span>
              <h2>التكاليف حسب التصنيف</h2>
            </div>
          </div>
          <div className={styles.expenseBreakdown}>
            {expenseRows.map(([label, metric]) => {
              const formatted = formattedMoney(metric, currency);
              return (
                <div key={label}>
                  <span>{label}</span>
                  <strong className={formatted.unavailable ? styles.unavailableValue : undefined}>
                    {formatted.value}
                  </strong>
                </div>
              );
            })}
          </div>
          <div className={styles.boundaryNote}>
            <strong>حدود الإنفاق الإعلاني و ROAS</strong>
            <p>
              Media CAC و MER يستخدمان إجمالي الإنفاق الإعلاني الصريح للبزنس أو مجموع الفانلز عند
              اكتمال توزيعها، ولا يتم جمع الاثنين معًا. إدخال الإنفاق هنا لا يضيف مصروفًا جديدًا إلى
              الربح؛ مصروف الإعلان يظل ضمن تكاليف الاكتساب. ROAS على مستوى البزنس يظل غير متاح بدون
              إسناد business-level حقيقي.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: businessesData, error: businessesError } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone")
    .order("created_at", { ascending: false });

  const businesses = (businessesData ?? []) as BusinessRow[];

  if (businessesError) {
    return (
      <div className="page-stack">
        <PageHeading title="الرئيسية" description="لوحة المؤشرات المالية للبزنس." />
        <section className={styles.errorPanel} role="alert">
          <strong>تعذر تحميل البزنسات</strong>
          <p>لم يتم عرض أي أرقام حتى لا نعتمد على بيانات ناقصة.</p>
        </section>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="page-stack">
        <PageHeading
          title="الرئيسية"
          description="مساحتك المركزية لفهم اقتصاديات البزنس واتخاذ قرارات مالية أوضح."
        />
        <section className={styles.emptyState}>
          <span className={styles.eyebrow}>ابدأ بإعداد البزنس</span>
          <h2>أضف أول بزنس قبل عرض الداشبورد</h2>
          <p>حدد الاسم والعملة والمنطقة الزمنية، ثم أضف مصادر الإيراد والمصروفات والأرقام الشهرية.</p>
          <Link className={styles.primaryAction} href="/businesses/new">
            إعداد أول بزنس
          </Link>
        </section>
      </div>
    );
  }

  const selectedBusiness =
    businesses.find((business) => business.id === query.business) ?? businesses[0];
  const fallbackMonth = currentMonthKeyForTimeZone(selectedBusiness.timezone);
  const selectedMonth = parseMonthKey(query.month) ?? parseMonthKey(fallbackMonth);

  if (!selectedMonth) {
    throw new Error("Could not resolve a valid dashboard month.");
  }

  const dashboardMonth = await loadDashboardMonth(
    supabase,
    selectedBusiness.id,
    selectedMonth.monthStart,
  );
  const { periodExists, result, dataLoadError, calculationError } = dashboardMonth;

  const monthLabel = new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${selectedMonth.monthStart}T00:00:00.000Z`));

  return (
    <div className="page-stack">
      <div className={styles.dashboardHeader}>
        <PageHeading
          title="لوحة البزنس"
          description={`نظرة مالية على ${selectedBusiness.name} للفترة المختارة بدون مقارنات أو توقعات.`}
        />
        <div className={styles.headerActions}>
          <Link
            className={styles.secondaryAction}
            href={`/businesses/${selectedBusiness.id}/monthly?month=${selectedMonth.monthKey}`}
          >
            تعديل أرقام الشهر
          </Link>
          <Link
            className={styles.secondaryAction}
            href={`/businesses/${selectedBusiness.id}/funnels/monthly?month=${selectedMonth.monthKey}`}
          >
            أرقام الفانلز
          </Link>
          <Link className={styles.secondaryAction} href="/businesses">
            إعدادات البزنس
          </Link>
        </div>
      </div>

      <section className={styles.controls} aria-label="اختيار البزنس والفترة">
        <form className={styles.controlForm}>
          <input type="hidden" name="month" value={selectedMonth.monthKey} />
          <label>
            <span>البزنس</span>
            <select name="business" defaultValue={selectedBusiness.id} aria-label="البزنس">
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name} — {business.base_currency}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">فتح البزنس</button>
        </form>

        <form className={styles.controlForm}>
          <input type="hidden" name="business" value={selectedBusiness.id} />
          <label>
            <span>الشهر</span>
            <input
              dir="ltr"
              type="month"
              name="month"
              defaultValue={selectedMonth.monthKey}
              aria-label="شهر الداشبورد"
            />
          </label>
          <button type="submit">فتح الشهر</button>
        </form>

        <div className={styles.periodBadge}>
          <span>الفترة المعروضة</span>
          <strong>{monthLabel}</strong>
          <small>{periodExists ? "بيانات محفوظة" : "لا توجد بيانات محفوظة"}</small>
        </div>
      </section>

      {(dataLoadError || calculationError) && (
        <section className={styles.errorPanel} role="alert">
          <strong>تعذر حساب الداشبورد بأمان</strong>
          <p>
            البيانات الشهرية لم تُحمّل كاملة أو تحتوي على قيمة تاريخية غير صالحة. لم يتم تخمين أي
            رقم. راجع بيانات الشهر ثم أعد المحاولة.
          </p>
        </section>
      )}

      {!dataLoadError && !calculationError && !periodExists && (
        <EmptyDashboard business={selectedBusiness} monthKey={selectedMonth.monthKey} />
      )}

      {!dataLoadError && !calculationError && result && (
        <DashboardMetrics result={result} currency={selectedBusiness.base_currency} />
      )}
    </div>
  );
}
