import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { resolvePreviousComparisonMonth } from "@/lib/business/comparison-period";
import { loadDecisionDashboard } from "@/lib/business/decision-dashboard";
import { currentMonthKeyForTimeZone, parseMonthKey } from "@/lib/business/monthly";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DecisionInsightsPanel } from "./decision-insights-panel";
import styles from "./insights.module.css";

type InsightsPageProps = {
  searchParams: Promise<{
    business?: string;
    month?: string;
  }>;
};

type BusinessRow = {
  id: string;
  name: string;
  base_currency: string;
  timezone: string;
};

function monthLabel(monthStart: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthStart}T00:00:00.000Z`));
}

/** Renders the deterministic Decision Engine against one business month and its prior month. */
export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: businessesData, error: businessesError } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone")
    .order("created_at", { ascending: false });

  const businesses = (businessesData ?? []) as BusinessRow[];

  if (businessesError) {
    return (
      <div className={styles.page}>
        <PageHeading title="أهم الملاحظات" description="Decision Engine مبني على قواعد مالية حتمية." />
        <section className={styles.errorPanel} role="alert">
          <strong>تعذر تحميل البزنسات</strong>
          <p>لم يتم إنشاء أي استنتاج حتى لا يعتمد ميزان على بيانات غير مكتملة.</p>
        </section>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className={styles.page}>
        <PageHeading title="أهم الملاحظات" description="Decision Engine مبني على قواعد مالية حتمية." />
        <section className={styles.emptyState}>
          <h2>أضف أول بزنس قبل تشغيل Decision Engine</h2>
          <p>يحتاج ميزان بيانات شهرية فعلية قبل تقييم الربحية أو تكلفة الاستحواذ أو الفانل.</p>
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

  if (!selectedMonth) throw new Error("Could not resolve a valid Decision Engine month.");

  const previousResolution = resolvePreviousComparisonMonth(selectedMonth.monthKey);
  const previousMonth = previousResolution.parsed;
  const decision = await loadDecisionDashboard(
    supabase,
    selectedBusiness.id,
    selectedMonth.monthStart,
    previousMonth?.monthStart ?? null,
  );

  const currentLabel = monthLabel(selectedMonth.monthStart);
  const previousLabel = previousMonth ? monthLabel(previousMonth.monthStart) : "الشهر السابق غير المدعوم";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <PageHeading
          title="أهم الملاحظات"
          description={`أهم ما يحتاج انتباهك في ${selectedBusiness.name} بناءً على البيانات الفعلية والقواعد الحتمية فقط.`}
        />
        <div className={styles.headerActions}>
          <Link
            className={styles.secondaryAction}
            href={`/?business=${selectedBusiness.id}&month=${selectedMonth.monthKey}`}
          >
            فتح داشبورد الشهر
          </Link>
          <Link
            className={styles.secondaryAction}
            href={`/analytics?business=${selectedBusiness.id}&month=${selectedMonth.monthKey}`}
          >
            فتح المقارنة والتحليلات
          </Link>
        </div>
      </div>

      <section className={styles.controls} aria-label="اختيار بزنس وشهر Decision Engine">
        <form className={styles.controlForm}>
          <input type="hidden" name="month" value={selectedMonth.monthKey} />
          <label>
            <span>البزنس</span>
            <select name="business" defaultValue={selectedBusiness.id} aria-label="بزنس أهم الملاحظات">
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
            <span>الشهر المرجعي</span>
            <input
              dir="ltr"
              type="month"
              name="month"
              defaultValue={selectedMonth.monthKey}
              aria-label="شهر أهم الملاحظات"
            />
          </label>
          <button type="submit">فتح الشهر</button>
        </form>

        <div className={styles.periodBadge}>
          <span>أساس الحكم</span>
          <strong>{currentLabel}</strong>
          <small>مقابل {previousLabel}</small>
        </div>
      </section>

      {decision.sourceLoadError && (
        <section className={styles.errorPanel} role="alert">
          <strong>تعذر تحميل بعض مصادر الحكم بأمان</strong>
          <p>سيعرض ميزان فقط الملاحظات التي ما زالت مدعومة بأدلة كافية، ولن يعوّض البيانات الناقصة بافتراضات.</p>
        </section>
      )}

      {!decision.currentPeriodExists && (
        <section className={styles.emptyState}>
          <h2>لا توجد أرقام محفوظة لـ {currentLabel}</h2>
          <p>أدخل بيانات الشهر المرجعي أولًا حتى يستطيع Decision Engine تقييم البزنس.</p>
          <Link
            className={styles.primaryAction}
            href={`/businesses/${selectedBusiness.id}/monthly?month=${selectedMonth.monthKey}`}
          >
            إدخال أرقام {currentLabel}
          </Link>
        </section>
      )}

      {decision.currentPeriodExists && previousMonth && !decision.previousPeriodExists && (
        <section className={styles.emptyState}>
          <h2>لا توجد قاعدة مقارنة لـ {previousLabel}</h2>
          <p>سيمنع ميزان أي قاعدة تحتاج الشهر السابق بدل اعتبار الشهر المفقود صفرًا.</p>
          <Link
            className={styles.primaryAction}
            href={`/businesses/${selectedBusiness.id}/monthly?month=${previousMonth.monthKey}`}
          >
            إدخال أرقام {previousLabel}
          </Link>
        </section>
      )}

      <DecisionInsightsPanel
        insights={decision.model.insights}
        fallbackMessageAr={decision.model.fallbackMessageAr}
        currentMonthLabel={currentLabel}
        previousMonthLabel={previousLabel}
      />
    </div>
  );
}
