import Link from "next/link";
import { AdminBusinessViewingBanner } from "@/components/admin-business-viewing-banner";
import { DashboardMetricDrawer } from "@/components/dashboard-metric-drawer";
import { PageHeading } from "@/components/page-heading";
import { resolveAdminViewingMentee } from "@/lib/admin-business-viewing";
import type { MenteeDirectoryRow } from "@/lib/admin/mentee-directory";
import { requireAuthContext } from "@/lib/auth/context";
import type {
  CalculatedMetric,
  CalculationUnavailableReason,
  CoreCalculationInput,
  CoreCalculationResult,
  ExactRatio,
} from "@/lib/business/calculations";
import { loadDashboardMonth } from "@/lib/business/dashboard-month";
import { buildOverviewReadinessModel, type OverviewReadinessModel } from "@/lib/business/overview-readiness";
import { loadOverviewReadiness } from "@/lib/business/overview-readiness-server";
import { createCoreMetricAudits, type MetricAudit } from "@/lib/business/metric-audit";
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
  owner_user_id: string;
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

/** Formats an exact decimal string for Arabic Overview display without changing stored values. */
function formattedDecimal(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? numberFormatter.format(number) : value;
}

/** Formats an available money metric or its canonical unavailable reason for Overview. */
function formattedMoney(metric: CalculatedMetric<string>, currency: string) {
  return metric.available
    ? { value: `${formattedDecimal(metric.value)} ${currency}`, unavailable: false as const }
    : { value: UNAVAILABLE_LABELS[metric.reason], unavailable: true as const };
}

/** Formats an available count metric or its canonical unavailable reason for Overview. */
function formattedCount(metric: CalculatedMetric<number>) {
  return metric.available
    ? { value: numberFormatter.format(metric.value), unavailable: false as const }
    : { value: UNAVAILABLE_LABELS[metric.reason], unavailable: true as const };
}

/** Converts an exact ratio to a finite display number when safe for presentation. */
function ratioNumber(ratio: ExactRatio) {
  const numerator = Number(ratio.numerator);
  const denominator = Number(ratio.denominator);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

/** Formats exact ratio metrics as either percentages or money without changing calculation semantics. */
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

/** Formats an exact ratio as a multiple for MER display. */
function formattedMultiple(metric: CalculatedMetric<ExactRatio>) {
  if (!metric.available) {
    return { value: UNAVAILABLE_LABELS[metric.reason], unavailable: true as const };
  }

  const number = ratioNumber(metric.value);
  return {
    value:
      number === null
        ? `${metric.value.numerator}/${metric.value.denominator}`
        : `${numberFormatter.format(number)}×`,
    unavailable: false as const,
  };
}

/** Renders one Dashboard KPI card with in-context audit inspection. */
function MetricCard({
  label,
  value,
  note,
  audit,
  currency,
  businessId,
  monthKey,
  featured = false,
  unavailable = false,
}: {
  label: string;
  value: string;
  note?: string;
  audit: MetricAudit;
  currency: string;
  businessId: string;
  monthKey: string;
  featured?: boolean;
  unavailable?: boolean;
}) {
  return (
    <article className={`${styles.metricCard} ${featured ? styles.featuredMetric : ""}`}>
      <span>{label}</span>
      <strong className={unavailable ? styles.unavailableValue : undefined}>{value}</strong>
      {note && <p>{note}</p>}
      <DashboardMetricDrawer
        audit={audit}
        currency={currency}
        businessId={businessId}
        monthKey={monthKey}
      />
    </article>
  );
}

/** Renders a compact Dashboard metric row with the same audit drawer behavior. */
function DetailMetric({
  label,
  value,
  unavailable,
  audit,
  currency,
  businessId,
  monthKey,
}: {
  label: string;
  value: string;
  unavailable: boolean;
  audit: MetricAudit;
  currency: string;
  businessId: string;
  monthKey: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={unavailable ? styles.unavailableValue : undefined}>{value}</dd>
      <DashboardMetricDrawer
        compact
        audit={audit}
        currency={currency}
        businessId={businessId}
        monthKey={monthKey}
      />
    </div>
  );
}

/** Renders B16's compact four-domain data readiness summary with at most one next action. */
function DataReadinessSection({
  model,
  suppressAction = false,
}: {
  model: OverviewReadinessModel;
  suppressAction?: boolean;
}) {
  return (
    <section className={styles.readinessSection} aria-labelledby="overview-readiness-title">
      <div className={styles.readinessHeading}>
        <div>
          <span className={styles.eyebrow}>جاهزية البيانات</span>
          <h2 id="overview-readiness-title">بياناتك</h2>
        </div>
        <p>ملخص سريع لما أصبح متاحًا للتحليل وما يحتاج خطوة إضافية.</p>
      </div>
      <dl className={styles.readinessGrid}>
        {model.rows.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd data-tone={row.tone}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {model.action && !suppressAction ? (
        <div className={styles.readinessAction}>
          <span>الخطوة التالية</span>
          <Link href={model.action.href}>{model.action.label}</Link>
        </div>
      ) : model.state === "unavailable" ? (
        <p className={styles.readinessUnavailable}>تعذر التحقق من بعض البيانات الآن.</p>
      ) : model.state === "read_only" ? (
        <p className={styles.readinessUnavailable}>
          هذا البزنس متاح لك للعرض فقط. تحديث البيانات يحتاج مالك البزنس أو مديرًا.
        </p>
      ) : suppressAction && model.state === "action_required" ? null : (
        <p className={styles.readinessComplete}>بياناتك الأساسية جاهزة للتحليل.</p>
      )}
    </section>
  );
}

/** Renders the no-saved-month Overview state with the existing monthly-entry action. */
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

/** Renders the saved-month Dashboard metric groups without changing calculation semantics. */
function DashboardMetrics({
  result,
  calculationInput,
  currency,
  businessId,
  monthKey,
  readinessModel,
}: {
  result: CoreCalculationResult;
  calculationInput: CoreCalculationInput;
  currency: string;
  businessId: string;
  monthKey: string;
  readinessModel: OverviewReadinessModel;
}) {
  const audits = createCoreMetricAudits(result, calculationInput);
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
    ["تكاليف الاكتساب", result.expensesByCategory.acquisition, audits.acquisitionCosts],
    [
      "تكاليف التنفيذ وخدمة العملاء",
      result.expensesByCategory.fulfillment,
      audits.fulfillmentCosts,
    ],
    ["المصاريف التشغيلية العامة", result.expensesByCategory.overhead, audits.overheadCosts],
    ["المصاريف المالية", result.expensesByCategory.financial, audits.financialCosts],
  ] as const;

  return (
    <>
      <section className={styles.primaryMetrics} aria-label="المؤشرات المالية الأساسية">
        <MetricCard
          featured
          label="صافي الكاش المحصل"
          value={netCash.value}
          unavailable={netCash.unavailable}
          note="الإيراد المحصل فعليًا بعد المرتجعات"
          audit={audits.netCashCollected}
          currency={currency}
          businessId={businessId}
          monthKey={monthKey}
        />
        <MetricCard
          featured
          label="صافي الربح الحقيقي"
          value={profit.value}
          unavailable={profit.unavailable}
          note="بعد كل تكاليف البزنس"
          audit={audits.realNetProfit}
          currency={currency}
          businessId={businessId}
          monthKey={monthKey}
        />
        <MetricCard
          featured
          label="هامش صافي الربح الحقيقي"
          value={margin.value}
          unavailable={margin.unavailable}
          note="صافي الربح الحقيقي ÷ صافي الكاش المحصل"
          audit={audits.realNetProfitMargin}
          currency={currency}
          businessId={businessId}
          monthKey={monthKey}
        />
        <MetricCard
          featured
          label="Ultimate CAC"
          value={ultimateCac.value}
          unavailable={ultimateCac.unavailable}
          note="التكلفة الكاملة للبزنس لكل عميل جديد — مقياس ميزان وليس CAC التقليدي"
          audit={audits.ultimateCac}
          currency={currency}
          businessId={businessId}
          monthKey={monthKey}
        />
      </section>

      <DataReadinessSection model={readinessModel} />

      <section
        className={`${styles.sectionCard} ${styles.secondarySection}`}
        aria-label="المؤشرات المالية الإضافية"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>تفاصيل إضافية</span>
            <h2>مؤشرات مساندة</h2>
          </div>
          <p>مؤشرات مفيدة للتشخيص بعد قراءة الأرقام الأربعة الأساسية.</p>
        </div>
        <div className={styles.secondaryMetrics}>
          <MetricCard
            label="Acquisition CAC"
            value={acquisitionCac.value}
            unavailable={acquisitionCac.unavailable}
            note="كل تكاليف الاكتساب والمبيعات والتسويق ÷ العملاء الجدد"
            audit={audits.acquisitionCac}
            currency={currency}
          businessId={businessId}
          monthKey={monthKey}
          />
          <MetricCard
            label="Media CAC"
            value={mediaCac.value}
            unavailable={mediaCac.unavailable}
            note="إجمالي الإنفاق الإعلاني المعتمد ÷ العملاء الجدد"
            audit={audits.mediaCac}
            currency={currency}
          businessId={businessId}
          monthKey={monthKey}
          />
          <MetricCard
            label="MER"
            value={mer.value}
            unavailable={mer.unavailable}
            note="صافي الكاش المحصل ÷ إجمالي الإنفاق الإعلاني المعتمد"
            audit={audits.mer}
            currency={currency}
          businessId={businessId}
          monthKey={monthKey}
          />
          <MetricCard
            label="هامش المساهمة"
            value={contributionMargin.value}
            unavailable={contributionMargin.unavailable}
            audit={audits.contributionMargin}
            currency={currency}
          businessId={businessId}
          monthKey={monthKey}
          />
          <MetricCard
            label="ربح المساهمة"
            value={contributionProfit.value}
            unavailable={contributionProfit.unavailable}
            audit={audits.contributionProfit}
            currency={currency}
          businessId={businessId}
          monthKey={monthKey}
          />
          <MetricCard
            label="إجمالي تكاليف البزنس"
            value={allCosts.value}
            unavailable={allCosts.unavailable}
            audit={audits.allBusinessCosts}
            currency={currency}
          businessId={businessId}
          monthKey={monthKey}
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
            <DetailMetric
              label="إجمالي الكاش المحصل قبل المرتجعات"
              value={grossCash.value}
              unavailable={grossCash.unavailable}
              audit={audits.grossCashCollected}
              currency={currency}
          businessId={businessId}
          monthKey={monthKey}
            />
            <DetailMetric
              label="المرتجعات"
              value={refunds.value}
              unavailable={refunds.unavailable}
              audit={audits.refunds}
              currency={currency}
          businessId={businessId}
          monthKey={monthKey}
            />
            <DetailMetric
              label="العملاء الجدد"
              value={newCustomers.value}
              unavailable={newCustomers.unavailable}
              audit={audits.newCustomers}
              currency={currency}
          businessId={businessId}
          monthKey={monthKey}
            />
            <DetailMetric
              label="إجمالي العملاء الدافعين"
              value={payingCustomers.value}
              unavailable={payingCustomers.unavailable}
              audit={audits.totalPayingCustomers}
              currency={currency}
          businessId={businessId}
          monthKey={monthKey}
            />
            <DetailMetric
              label="العملاء العائدون"
              value={returningCustomers.value}
              unavailable={returningCustomers.unavailable}
              audit={audits.returningCustomers}
              currency={currency}
          businessId={businessId}
          monthKey={monthKey}
            />
            <DetailMetric
              label="الإيراد لكل عميل دافع"
              value={revenuePerPaying.value}
              unavailable={revenuePerPaying.unavailable}
              audit={audits.revenuePerPayingCustomer}
              currency={currency}
          businessId={businessId}
          monthKey={monthKey}
            />
            <DetailMetric
              label="الإيراد لكل عميل جديد"
              value={revenuePerNew.value}
              unavailable={revenuePerNew.unavailable}
              audit={audits.revenuePerNewCustomer}
              currency={currency}
          businessId={businessId}
          monthKey={monthKey}
            />
          </dl>
          <p className={styles.definitionNote}>
            القيمتان الأخيرتان مؤشرا إيراد لكل عميل وليستا LTV. قيمة العميل الحقيقية تأتي من تاريخ
            المعاملات والكوهورتات.
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
            {expenseRows.map(([label, metric, audit]) => {
              const formatted = formattedMoney(metric, currency);
              return (
                <div key={label}>
                  <span>{label}</span>
                  <strong className={formatted.unavailable ? styles.unavailableValue : undefined}>
                    {formatted.value}
                  </strong>
                  <DashboardMetricDrawer
                    compact
                    audit={audit}
                    currency={currency}
                    businessId={businessId}
                    monthKey={monthKey}
                  />
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
  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: businessesData, error: businessesError } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,owner_user_id")
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
  const canManage = auth.role === "admin" || selectedBusiness.owner_user_id === auth.userId;

  let adminViewingMenteeUserId: string | null = null;
  if (auth.role === "admin" && selectedBusiness.owner_user_id !== auth.userId) {
    const { data: directoryRows, error: directoryError } = await supabase.rpc(
      "admin_mentee_directory",
    );
    if (!directoryError) {
      adminViewingMenteeUserId =
        resolveAdminViewingMentee(
          auth.role,
          auth.userId,
          selectedBusiness.owner_user_id,
          (directoryRows ?? []) as MenteeDirectoryRow[],
        )?.userId ?? null;
    }
  }

  const fallbackMonth = currentMonthKeyForTimeZone(selectedBusiness.timezone);
  const selectedMonth = parseMonthKey(query.month) ?? parseMonthKey(fallbackMonth);

  if (!selectedMonth) {
    throw new Error("Could not resolve a valid dashboard month.");
  }

  const [dashboardMonth, readiness] = await Promise.all([
    loadDashboardMonth(supabase, selectedBusiness.id, selectedMonth.monthStart),
    loadOverviewReadiness(selectedBusiness.id, selectedMonth.monthStart),
  ]);
  const { periodExists, result, calculationInput, dataLoadError, calculationError } = dashboardMonth;
  const readinessModel = buildOverviewReadinessModel({
    businessId: selectedBusiness.id,
    monthKey: selectedMonth.monthKey,
    core: readiness.core,
    history: readiness.history,
    customers: readiness.customers,
    sales: readiness.sales,
    canManage,
  });

  const monthLabel = new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${selectedMonth.monthStart}T00:00:00.000Z`));

  return (
    <div className="page-stack">
      {adminViewingMenteeUserId && (
        <AdminBusinessViewingBanner menteeUserId={adminViewingMenteeUserId} />
      )}

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
        <>
          <EmptyDashboard business={selectedBusiness} monthKey={selectedMonth.monthKey} />
          <DataReadinessSection model={readinessModel} suppressAction />
        </>
      )}

      {!dataLoadError && !calculationError && result && calculationInput && (
        <DashboardMetrics
          result={result}
          calculationInput={calculationInput}
          currency={selectedBusiness.base_currency}
          businessId={selectedBusiness.id}
          monthKey={selectedMonth.monthKey}
          readinessModel={readinessModel}
        />
      )}
    </div>
  );
}
