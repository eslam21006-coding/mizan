import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { resolvePreviousComparisonMonth } from "@/lib/business/comparison-period";
import { loadDashboardMonth } from "@/lib/business/dashboard-month";
import { loadDashboardRange } from "@/lib/business/dashboard-range";
import { formatArabicRemainingMonths } from "@/lib/business/historical-copy";
import {
  MAX_CUSTOM_RANGE_MONTHS,
  parseHistoricalPeriodMode,
  resolveHistoricalPeriod,
} from "@/lib/business/historical-period";
import { currentMonthKeyForTimeZone, parseMonthKey } from "@/lib/business/monthly";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import dashboardStyles from "../dashboard.module.css";
import { HistoricalAnalytics } from "../historical-analytics";
import { MonthComparison } from "../month-comparison";

type AnalyticsPageProps = {
  searchParams: Promise<{
    business?: string;
    month?: string;
    period?: string;
    start?: string;
    end?: string;
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

function rangeLabel(startMonthKey: string, endMonthKey: string) {
  const start = monthLabel(`${startMonthKey}-01`);
  const end = monthLabel(`${endMonthKey}-01`);
  return startMonthKey === endMonthKey ? start : `${start} — ${end}`;
}

function missingMonthsText(monthKeys: readonly string[]) {
  const visible = monthKeys.slice(0, 6).map((monthKey) => monthLabel(`${monthKey}-01`));
  const remaining = monthKeys.length - visible.length;
  if (remaining === 0) return visible.join("، ");
  return `${visible.join("، ")}، ${formatArabicRemainingMonths(remaining)}`;
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
        <PageHeading title="التحليلات" description="تحليل مالي مبني على الأرقام الفعلية المحفوظة." />
        <section className={dashboardStyles.errorPanel} role="alert">
          <strong>تعذر تحميل البزنسات</strong>
          <p>لم يتم عرض أي تحليل حتى لا نعتمد على بيانات ناقصة.</p>
        </section>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="page-stack">
        <PageHeading
          title="التحليلات"
          description="قارن الأداء وابنِ رؤية تاريخية بعد إدخال الأرقام الفعلية."
        />
        <section className={dashboardStyles.emptyState}>
          <span className={dashboardStyles.eyebrow}>لا يوجد بزنس بعد</span>
          <h2>أضف أول بزنس قبل بناء التحليلات</h2>
          <p>التحليل يحتاج بزنسًا وبيانات شهرية محفوظة على الأقل.</p>
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

  if (!selectedMonth) throw new Error("Could not resolve a valid analytics month.");

  const historicalMode = parseHistoricalPeriodMode(query.period);
  const customStart = parseMonthKey(query.start)?.monthKey ?? selectedMonth.monthKey;
  const customEnd = parseMonthKey(query.end)?.monthKey ?? selectedMonth.monthKey;
  const historicalResolution = resolveHistoricalPeriod(
    historicalMode,
    selectedMonth.monthKey,
    customStart,
    customEnd,
  );

  const previousResolution = resolvePreviousComparisonMonth(selectedMonth.monthKey);
  const previousMonth = previousResolution.parsed;
  const [currentLoad, previousLoad, historicalLoad] = await Promise.all([
    loadDashboardMonth(supabase, selectedBusiness.id, selectedMonth.monthStart),
    previousMonth
      ? loadDashboardMonth(supabase, selectedBusiness.id, previousMonth.monthStart)
      : Promise.resolve({
          periodExists: false,
          result: null,
          dataLoadError: false,
          calculationError: false,
        }),
    historicalResolution.ok
      ? loadDashboardRange(supabase, selectedBusiness.id, historicalResolution.monthKeys)
      : Promise.resolve(null),
  ]);

  const currentLabel = monthLabel(selectedMonth.monthStart);
  const previousLabel = previousResolution.monthKey
    ? monthLabel(`${previousResolution.monthKey}-01`)
    : "الشهر السابق";
  const comparisonHasLoadError =
    currentLoad.dataLoadError ||
    currentLoad.calculationError ||
    previousLoad.dataLoadError ||
    previousLoad.calculationError;
  const historicalPeriodLabel = historicalResolution.ok
    ? rangeLabel(historicalResolution.startMonthKey, historicalResolution.endMonthKey)
    : "فترة غير صالحة";

  return (
    <div className="page-stack">
      <div className={dashboardStyles.dashboardHeader}>
        <PageHeading
          title="التحليلات المالية"
          description={`قارن ${selectedBusiness.name} شهريًا وحلل الفترات التاريخية من نفس البيانات الفعلية المحفوظة.`}
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
          <input type="hidden" name="period" value={historicalMode} />
          <input type="hidden" name="start" value={customStart} />
          <input type="hidden" name="end" value={customEnd} />
          <label>
            <span>البزنس</span>
            <select name="business" defaultValue={selectedBusiness.id} aria-label="بزنس التحليلات">
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
          <input type="hidden" name="period" value={historicalMode} />
          <input type="hidden" name="start" value={customStart} />
          <input type="hidden" name="end" value={customEnd} />
          <label>
            <span>الشهر المرجعي</span>
            <input
              dir="ltr"
              type="month"
              name="month"
              defaultValue={selectedMonth.monthKey}
              aria-label="شهر التحليلات"
            />
          </label>
          <button type="submit">فتح الشهر</button>
        </form>

        <div className={dashboardStyles.periodBadge}>
          <span>المقارنة الشهرية</span>
          <strong>{currentLabel}</strong>
          <small>مقابل {previousLabel}</small>
        </div>
      </section>

      {comparisonHasLoadError && (
        <section className={dashboardStyles.errorPanel} role="alert">
          <strong>تعذر حساب المقارنة بأمان</strong>
          <p>أحد الشهرين لم يُحمّل كاملًا أو يحتوي على لقطة تاريخية غير صالحة. لم يتم تخمين أي رقم.</p>
        </section>
      )}

      {!comparisonHasLoadError && !currentLoad.periodExists && (
        <section className={dashboardStyles.emptyState}>
          <span className={dashboardStyles.eyebrow}>الشهر الحالي بلا بيانات</span>
          <h2>لا توجد أرقام محفوظة لـ {currentLabel}</h2>
          <p>أدخل أرقام الشهر الحالي أولًا، ثم ارجع إلى التحليلات.</p>
          <Link
            className={dashboardStyles.primaryAction}
            href={`/businesses/${selectedBusiness.id}/monthly?month=${selectedMonth.monthKey}`}
          >
            إدخال أرقام {currentLabel}
          </Link>
        </section>
      )}

      {!comparisonHasLoadError && currentLoad.result && !previousMonth && (
        <section className={dashboardStyles.emptyState}>
          <span className={dashboardStyles.eyebrow}>بداية النطاق الزمني المدعوم</span>
          <h2>لا يوجد شهر سابق قابل للمقارنة قبل {currentLabel}</h2>
          <p>{previousLabel} يقع قبل أول شهر يدعمه ميزان. لن نعتبره صفرًا ولن ننشئ مقارنة وهمية.</p>
        </section>
      )}

      {!comparisonHasLoadError && currentLoad.result && previousMonth && !previousLoad.periodExists && (
        <section className={dashboardStyles.emptyState}>
          <span className={dashboardStyles.eyebrow}>لا توجد قاعدة مقارنة</span>
          <h2>لا توجد أرقام محفوظة لـ {previousLabel}</h2>
          <p>أرقام {currentLabel} موجودة، لكن ميزان لن يخترع شهرًا سابقًا أو يعتبر البيانات المفقودة صفرًا.</p>
          <Link
            className={dashboardStyles.primaryAction}
            href={`/businesses/${selectedBusiness.id}/monthly?month=${previousMonth.monthKey}`}
          >
            إدخال أرقام {previousLabel}
          </Link>
        </section>
      )}

      {!comparisonHasLoadError && currentLoad.result && previousMonth && previousLoad.result && (
        <MonthComparison
          current={currentLoad.result}
          previous={previousLoad.result}
          currency={selectedBusiness.base_currency}
          currentMonthLabel={currentLabel}
          previousMonthLabel={previousLabel}
        />
      )}

      <section className={dashboardStyles.sectionCard} aria-label="اختيار فترة التحليل التاريخي">
        <div className={dashboardStyles.sectionHeading}>
          <div>
            <span className={dashboardStyles.eyebrow}>الفترة التاريخية</span>
            <h2>Rolling 3 Months / YTD / Custom Range</h2>
          </div>
          <p>الفترات المخصصة تستخدم أشهرًا كاملة فقط؛ لا يتم اختراع توزيع يومي للمصاريف الشهرية.</p>
        </div>
        <form className={dashboardStyles.controlForm}>
          <input type="hidden" name="business" value={selectedBusiness.id} />
          <input type="hidden" name="month" value={selectedMonth.monthKey} />
          <label>
            <span>نوع الفترة</span>
            <select name="period" defaultValue={historicalMode} aria-label="نوع الفترة التاريخية">
              <option value="rolling3">آخر 3 أشهر</option>
              <option value="ytd">من بداية السنة YTD</option>
              <option value="custom">فترة مخصصة</option>
            </select>
          </label>
          <label>
            <span>بداية الفترة المخصصة</span>
            <input
              dir="ltr"
              type="month"
              name="start"
              defaultValue={customStart}
              aria-label="بداية الفترة المخصصة"
            />
          </label>
          <label>
            <span>نهاية الفترة المخصصة</span>
            <input
              dir="ltr"
              type="month"
              name="end"
              defaultValue={customEnd}
              aria-label="نهاية الفترة المخصصة"
            />
          </label>
          <button type="submit">عرض الفترة</button>
        </form>
        <p className={dashboardStyles.definitionNote}>
          حقلا البداية والنهاية يُستخدمان فقط عند اختيار «فترة مخصصة». آخر 3 أشهر وYTD يُحسبان تلقائيًا من الشهر المرجعي أعلاه.
        </p>
      </section>

      {!historicalResolution.ok && (
        <section className={dashboardStyles.emptyState}>
          <span className={dashboardStyles.eyebrow}>الفترة غير قابلة للحساب</span>
          <h2>اختر فترة تاريخية صالحة داخل النطاق المدعوم</h2>
          <p>
            {historicalResolution.reason === "UNSUPPORTED_BOUNDARY"
              ? "الفترة المطلوبة تمتد قبل يناير 2000، لذلك لن يتم إنشاء أشهر غير مدعومة."
              : historicalResolution.reason === "CUSTOM_RANGE_TOO_LONG"
                ? `الفترة المخصصة يمكن أن تشمل حتى ${new Intl.NumberFormat("ar-EG").format(MAX_CUSTOM_RANGE_MONTHS)} شهرًا فقط في هذه النسخة.`
                : "تأكد أن بداية الفترة المخصصة ونهايتها صالحتان وأن البداية لا تأتي بعد النهاية."}
          </p>
        </section>
      )}

      {historicalResolution.ok && historicalLoad?.dataLoadError && (
        <section className={dashboardStyles.errorPanel} role="alert">
          <strong>تعذر تحميل الفترة التاريخية بأمان</strong>
          <p>فشل تحميل جزء من البيانات المحفوظة. لم يتم عرض مجموع جزئي على أنه نتيجة كاملة.</p>
        </section>
      )}

      {historicalResolution.ok && historicalLoad?.calculationError && (
        <section className={dashboardStyles.errorPanel} role="alert">
          <strong>توجد لقطة شهرية غير صالحة للحساب</strong>
          <p>أوقف ميزان النتيجة المجمعة بدل تجاهل الشهر أو تصحيح بياناته تلقائيًا.</p>
        </section>
      )}

      {historicalResolution.ok &&
        historicalLoad &&
        !historicalLoad.dataLoadError &&
        !historicalLoad.calculationError &&
        historicalLoad.missingMonthKeys.length > 0 && (
          <section className={dashboardStyles.emptyState}>
            <span className={dashboardStyles.eyebrow}>الفترة غير مكتملة</span>
            <h2>هناك أشهر بلا بيانات محفوظة</h2>
            <p>{missingMonthsText(historicalLoad.missingMonthKeys)}</p>
            <p>لن يعتبر ميزان الأشهر المفقودة صفرًا ولن يعرض مجموعًا ناقصًا كأنه الفترة كاملة.</p>
            <Link
              className={dashboardStyles.primaryAction}
              href={`/businesses/${selectedBusiness.id}/monthly?month=${historicalLoad.missingMonthKeys[0]}`}
            >
              إدخال أول شهر مفقود
            </Link>
          </section>
        )}

      {historicalResolution.ok && historicalLoad?.aggregate && (
        <HistoricalAnalytics
          aggregate={historicalLoad.aggregate}
          months={historicalLoad.months}
          currency={selectedBusiness.base_currency}
          periodLabel={historicalPeriodLabel}
        />
      )}

      <section className={dashboardStyles.sectionCard}>
        <div className={dashboardStyles.sectionHeading}>
          <div>
            <span className={dashboardStyles.eyebrow}>حدود الدقة</span>
            <h2>لا توجد دقة وهمية عبر الأشهر</h2>
          </div>
        </div>
        <p className={dashboardStyles.definitionNote}>
          الهوامش تُعاد من الإجماليات ولا يتم أخذ متوسط الهوامش الشهرية. أما المقاييس التي تحتاج عدد عملاء فريدًا عبر عدة أشهر فتظل محجوبة كقيمة دقيقة إلى أن يتوفر تاريخ معاملات يسمح بإزالة التكرار بين الأشهر. الفترات المخصصة في هذه النسخة تبدأ وتنتهي على حدود شهر كامل فقط.
        </p>
      </section>
    </div>
  );
}
