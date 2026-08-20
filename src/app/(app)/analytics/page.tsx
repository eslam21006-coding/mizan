import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { loadDashboardMonth } from "@/lib/business/dashboard-month";
import {
  currentMonthKeyForTimeZone,
  parseMonthKey,
  shiftMonthKey,
} from "@/lib/business/monthly";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import dashboardStyles from "../dashboard.module.css";
import { MonthComparison } from "../month-comparison";

type AnalyticsPageProps = {
  searchParams: Promise<{ business?: string; month?: string }>;
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

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
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
        <PageHeading title="التحليلات" description="مقارنة شهرية مبنية على الأرقام الفعلية المحفوظة." />
        <section className={dashboardStyles.errorPanel} role="alert">
          <strong>تعذر تحميل البزنسات</strong>
          <p>لم يتم عرض أي مقارنة حتى لا نعتمد على بيانات ناقصة.</p>
        </section>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="page-stack">
        <PageHeading
          title="التحليلات"
          description="قارن أداء البزنس شهرًا بشهر بعد إدخال الأرقام الفعلية."
        />
        <section className={dashboardStyles.emptyState}>
          <span className={dashboardStyles.eyebrow}>لا يوجد بزنس بعد</span>
          <h2>أضف أول بزنس قبل بناء المقارنات</h2>
          <p>المقارنة تحتاج بزنسًا وبيانات شهرية محفوظة على الأقل.</p>
          <Link className={dashboardStyles.primaryAction} href="/businesses/new">
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

  if (!selectedMonth) throw new Error("Could not resolve a valid comparison month.");

  const previousMonthKey = shiftMonthKey(selectedMonth.monthKey, -1);
  const previousMonth = previousMonthKey ? parseMonthKey(previousMonthKey) : null;
  if (!previousMonth) throw new Error("Could not resolve the previous comparison month.");

  const [currentLoad, previousLoad] = await Promise.all([
    loadDashboardMonth(supabase, selectedBusiness.id, selectedMonth.monthStart),
    loadDashboardMonth(supabase, selectedBusiness.id, previousMonth.monthStart),
  ]);

  const currentLabel = monthLabel(selectedMonth.monthStart);
  const previousLabel = monthLabel(previousMonth.monthStart);
  const hasLoadError =
    currentLoad.dataLoadError ||
    currentLoad.calculationError ||
    previousLoad.dataLoadError ||
    previousLoad.calculationError;

  return (
    <div className="page-stack">
      <div className={dashboardStyles.dashboardHeader}>
        <PageHeading
          title="المقارنة الشهرية"
          description={`قارن ${selectedBusiness.name} في ${currentLabel} بالشهر السابق مباشرة — بدون متوسطات أو توقعات.`}
        />
        <div className={dashboardStyles.headerActions}>
          <Link
            className={dashboardStyles.secondaryAction}
            href={`/?business=${selectedBusiness.id}&month=${selectedMonth.monthKey}`}
          >
            فتح داشبورد الشهر
          </Link>
          <Link
            className={dashboardStyles.secondaryAction}
            href={`/businesses/${selectedBusiness.id}/monthly?month=${selectedMonth.monthKey}`}
          >
            تعديل أرقام الشهر
          </Link>
        </div>
      </div>

      <section className={dashboardStyles.controls} aria-label="اختيار البزنس وشهر المقارنة">
        <form className={dashboardStyles.controlForm}>
          <input type="hidden" name="month" value={selectedMonth.monthKey} />
          <label>
            <span>البزنس</span>
            <select name="business" defaultValue={selectedBusiness.id} aria-label="بزنس المقارنة">
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name} — {business.base_currency}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">فتح البزنس</button>
        </form>

        <form className={dashboardStyles.controlForm}>
          <input type="hidden" name="business" value={selectedBusiness.id} />
          <label>
            <span>الشهر الحالي في المقارنة</span>
            <input
              dir="ltr"
              type="month"
              name="month"
              defaultValue={selectedMonth.monthKey}
              aria-label="شهر المقارنة"
            />
          </label>
          <button type="submit">قارن الشهر</button>
        </form>

        <div className={dashboardStyles.periodBadge}>
          <span>المقارنة</span>
          <strong>{currentLabel}</strong>
          <small>مقابل {previousLabel}</small>
        </div>
      </section>

      {hasLoadError && (
        <section className={dashboardStyles.errorPanel} role="alert">
          <strong>تعذر حساب المقارنة بأمان</strong>
          <p>
            أحد الشهرين لم يُحمّل كاملًا أو يحتوي على لقطة تاريخية غير صالحة. لم يتم تخمين أي رقم.
          </p>
        </section>
      )}

      {!hasLoadError && !currentLoad.periodExists && (
        <section className={dashboardStyles.emptyState}>
          <span className={dashboardStyles.eyebrow}>الشهر الحالي بلا بيانات</span>
          <h2>لا توجد أرقام محفوظة لـ {currentLabel}</h2>
          <p>أدخل أرقام الشهر الحالي أولًا، ثم ارجع إلى المقارنة.</p>
          <Link
            className={dashboardStyles.primaryAction}
            href={`/businesses/${selectedBusiness.id}/monthly?month=${selectedMonth.monthKey}`}
          >
            إدخال أرقام {currentLabel}
          </Link>
        </section>
      )}

      {!hasLoadError && currentLoad.result && !previousLoad.periodExists && (
        <section className={dashboardStyles.emptyState}>
          <span className={dashboardStyles.eyebrow}>لا توجد قاعدة مقارنة</span>
          <h2>لا توجد أرقام محفوظة لـ {previousLabel}</h2>
          <p>
            أرقام {currentLabel} موجودة، لكن ميزان لن يخترع شهرًا سابقًا أو يعتبر البيانات المفقودة صفرًا.
          </p>
          <Link
            className={dashboardStyles.primaryAction}
            href={`/businesses/${selectedBusiness.id}/monthly?month=${previousMonth.monthKey}`}
          >
            إدخال أرقام {previousLabel}
          </Link>
        </section>
      )}

      {!hasLoadError && currentLoad.result && previousLoad.result && (
        <MonthComparison
          current={currentLoad.result}
          previous={previousLoad.result}
          currency={selectedBusiness.base_currency}
          currentMonthLabel={currentLabel}
          previousMonthLabel={previousLabel}
        />
      )}

      <section className={dashboardStyles.sectionCard}>
        <div className={dashboardStyles.sectionHeading}>
          <div>
            <span className={dashboardStyles.eyebrow}>حدود المهمة الحالية</span>
            <h2>هذه مقارنة شهر بشهر فقط</h2>
          </div>
        </div>
        <p className={dashboardStyles.definitionNote}>
          Rolling 3 Month و YTD والفترات المخصصة والتحليل التاريخي متعدد الأشهر ليست جزءًا من هذه المقارنة، وسيتم بناؤها في المهمة التالية دون تغيير البيانات التاريخية الحالية.
        </p>
      </section>
    </div>
  );
}
