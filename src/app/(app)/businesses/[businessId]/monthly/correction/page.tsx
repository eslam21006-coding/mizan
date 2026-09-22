import Link from "next/link";
import { notFound } from "next/navigation";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { requireAuthContext } from "@/lib/auth/context";
import { loadTransactionDerivedMonthlyCustomerCounts } from "@/lib/business/monthly-customer-counts";
import {
  currentMonthKeyForTimeZone,
  parseMonthKey,
  shiftMonthKey,
  storedExpenseValueForDisplay,
} from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import {
  parseMonthlyExternalReturnOrigin,
  type MonthlyExternalReturnOrigin,
} from "@/lib/monthly-return-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ExpenseInputRow,
  MonthlyPeriodValues,
  RevenueInputRow,
} from "../monthly-entry-form";
import { HistoricalCorrectionForm } from "./historical-correction-form";
import { HistoricalCorrectionNavigation } from "./historical-correction-navigation";
import styles from "./historical-correction.module.css";

type HistoricalCorrectionPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{
    month?: string;
    status?: string;
    origin?: string | string[];
    return_month?: string | string[];
    insight_rule?: string | string[];
    insight_subject?: string | string[];
  }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  corrected: "تم حفظ التصحيح التاريخي وتسجيل نسخة قبل وبعد مع سبب التعديل.",
  "historical-required":
    "هذا الشهر محفوظ تاريخيًا. استخدم مسار التصحيح أدناه، واكتب سبب التعديل قبل الحفظ.",
  "invalid-month": "صيغة الشهر غير صحيحة.",
  "invalid-input": "راجع القيم وسبب التصحيح. السبب مطلوب ولا يتجاوز 500 حرف.",
  "invalid-customers": "عدد العملاء الجدد لا يمكن أن يتجاوز إجمالي العملاء الذين دفعوا خلال الشهر.",
  "correction-failed": "تعذر حفظ التصحيح. لم يتم حفظ تعديل جزئي.",
};

function asInputValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function monthLabel(monthStart: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthStart}T00:00:00.000Z`));
}

/** Preserves validated external Return metadata through correction month-picker submissions. */
function HistoricalReturnFields({
  returnOrigin,
}: {
  returnOrigin: MonthlyExternalReturnOrigin | null;
}) {
  if (!returnOrigin) return null;

  return (
    <>
      <input type="hidden" name="origin" value={returnOrigin.origin} />
      {(returnOrigin.origin === "customer-profitability" ||
        returnOrigin.origin === "insights") && (
        <input type="hidden" name="return_month" value={returnOrigin.month} />
      )}
      {returnOrigin.origin === "insights" && (
        <>
          <input type="hidden" name="insight_rule" value={returnOrigin.ruleId} />
          {returnOrigin.subjectId && (
            <input type="hidden" name="insight_subject" value={returnOrigin.subjectId} />
          )}
        </>
      )}
    </>
  );
}

/** Builds a Monthly-entry link that keeps the correction's external Return context intact. */
function buildMonthlyEntryHref(
  businessId: string,
  monthKey: string,
  returnOrigin: MonthlyExternalReturnOrigin | null,
) {
  const query = new URLSearchParams({ month: monthKey });
  if (returnOrigin) {
    query.set("origin", returnOrigin.origin);
    if (
      returnOrigin.origin === "customer-profitability" ||
      returnOrigin.origin === "insights"
    ) {
      query.set("return_month", returnOrigin.month);
    }
    if (returnOrigin.origin === "insights") {
      query.set("insight_rule", returnOrigin.ruleId);
      if (returnOrigin.subjectId) query.set("insight_subject", returnOrigin.subjectId);
    }
  }
  return `/businesses/${businessId}/monthly?${query.toString()}`;
}

/** Loads one existing past month and exposes only the explicit audited correction workflow. */
export default async function HistoricalCorrectionPage({
  params,
  searchParams,
}: HistoricalCorrectionPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError || !business) notFound();

  const query = await searchParams;
  const returnOrigin = parseMonthlyExternalReturnOrigin({
    origin: query.origin,
    month: query.return_month ?? query.month,
    insight_rule: query.insight_rule,
    insight_subject: query.insight_subject,
  });
  const currentMonthKey = currentMonthKeyForTimeZone(business.timezone);
  const latestHistoricalMonth = shiftMonthKey(currentMonthKey, -1) ?? currentMonthKey;
  const selectedMonth = parseMonthKey(query.month ?? latestHistoricalMonth);
  if (!selectedMonth) notFound();

  const statusMessage = query.status ? STATUS_MESSAGES[query.status] ?? null : null;
  const statusIsError = Boolean(
    query.status && !["corrected", "historical-required"].includes(query.status),
  );
  const isHistorical = selectedMonth.monthKey < currentMonthKey;
  const selectedMonthLabel = monthLabel(selectedMonth.monthStart);
  const correctionNavigation = (
    <HistoricalCorrectionNavigation
      businessId={businessId}
      businessName={business.name}
      baseCurrency={business.base_currency}
      timezone={business.timezone}
      monthKey={selectedMonth.monthKey}
      monthLabel={selectedMonthLabel}
      returnOrigin={returnOrigin}
    />
  );
  const returnBanner = returnOrigin ? (
    <ReturnContextBanner
      purpose={
        returnOrigin.origin === "insights"
          ? "تصحيح البيانات المرتبطة بهذه الملاحظة"
          : "تصحيح البيانات المرتبطة بمسار العمل السابق"
      }
      origin={returnOrigin}
      context={{ businessId }}
      returnLabel={
        returnOrigin.origin === "insights"
          ? "العودة إلى الملاحظة"
          : "العودة إلى المهمة السابقة"
      }
      ariaLabel="سياق العودة من التصحيح التاريخي"
    />
  ) : null;

  if (!isHistorical) {
    return (
      <div className={styles.page}>
        {correctionNavigation}
        {returnBanner}
        <div className={styles.headingRow}>
          <div>
            <span className={styles.eyebrow}>تصحيح تاريخي صريح</span>
            <h1>تصحيح بيانات شهر سابق</h1>
            <p>هذا المسار مخصص فقط لشهر أقدم من الشهر الحالي للبزنس.</p>
          </div>
        </div>
        <form className={styles.monthPicker}>
          <HistoricalReturnFields returnOrigin={returnOrigin} />
          <label>
            <span>اختر شهرًا سابقًا</span>
            <input type="month" name="month" defaultValue={latestHistoricalMonth} max={latestHistoricalMonth} />
          </label>
          <button type="submit">فتح الشهر</button>
        </form>
        {statusMessage && (
          <div className={statusIsError ? styles.errorStatus : styles.successStatus} role="status">
            {statusMessage}
          </div>
        )}
        <div className={styles.errorStatus}>
          اختر شهرًا قبل {monthLabel(`${currentMonthKey}-01`)} لاستخدام مسار التصحيح التاريخي.
        </div>
      </div>
    );
  }

  const [periodResult, streamsResult, expensesResult, customerCountsResult] = await Promise.all([
    supabase
      .from("monthly_periods")
      .select(
        "id,new_customers,total_paying_customers,unallocated_gross_cash_collected,unallocated_refunds,adjustment_note",
      )
      .eq("business_id", businessId)
      .eq("month_start", selectedMonth.monthStart)
      .maybeSingle(),
    supabase
      .from("revenue_streams")
      .select("id,name,stream_type,is_active,created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
    supabase
      .from("expense_items")
      .select("id,name,category,cost_behavior,is_active,created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
    loadTransactionDerivedMonthlyCustomerCounts(supabase, businessId, selectedMonth.monthStart),
  ]);

  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;
  const period = periodResult.data;

  if (periodResult.error || streamsResult.error || expensesResult.error || customerCountsResult.dataLoadError) {
    return (
      <div className={styles.page}>
        {correctionNavigation}
        {returnBanner}
        <div className={styles.headingRow}>
          <div>
            <span className={styles.eyebrow}>تصحيح تاريخي صريح</span>
            <h1>تصحيح بيانات شهر سابق</h1>
          </div>
        </div>
        <div className={styles.errorStatus}>تعذر تحميل بيانات الشهر كاملة. تم إيقاف التصحيح حتى لا يتم حفظ بيانات ناقصة.</div>
      </div>
    );
  }

  if (!period) {
    return (
      <div className={styles.page}>
        {correctionNavigation}
        {returnBanner}
        <div className={styles.headingRow}>
          <div>
            <span className={styles.eyebrow}>تصحيح تاريخي صريح</span>
            <h1>تصحيح بيانات شهر سابق</h1>
            <p>{business.name} · {selectedMonthLabel}</p>
          </div>
        </div>
        <form className={styles.monthPicker}>
          <HistoricalReturnFields returnOrigin={returnOrigin} />
          <label>
            <span>الشهر المراد تصحيحه</span>
            <input type="month" name="month" defaultValue={selectedMonth.monthKey} max={latestHistoricalMonth} />
          </label>
          <button type="submit">فتح الشهر</button>
        </form>
        {statusMessage && (
          <div className={statusIsError ? styles.errorStatus : styles.successStatus} role="status">
            {statusMessage}
          </div>
        )}
        <section className={styles.emptyState}>
          <div>
            <span className={styles.eyebrow}>لا توجد نسخة تاريخية بعد</span>
            <h2>هذا الشهر لم يُحفظ من قبل</h2>
            <p>التصحيح التاريخي لا ينشئ شهرًا مفقودًا. أدخل الشهر أول مرة من مسار الإدخال الشهري العادي، وبعدها تصبح أي تعديلات لاحقة تصحيحًا تاريخيًا مسجلًا.</p>
          </div>
          <div className={styles.emptyActions}>
            <Link
              className={styles.monthlyLink}
              href={buildMonthlyEntryHref(businessId, selectedMonth.monthKey, returnOrigin)}
            >
              إدخال هذا الشهر لأول مرة
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const [revenueResult, expenseResult] = await Promise.all([
    supabase
      .from("monthly_revenue_entries")
      .select(
        "revenue_stream_id,stream_name_snapshot,stream_type_snapshot,gross_cash_collected,refunds",
      )
      .eq("business_id", businessId)
      .eq("monthly_period_id", period.id),
    supabase
      .from("monthly_expense_entries")
      .select(
        "expense_item_id,expense_name_snapshot,category_snapshot,cost_behavior_snapshot,input_value,customer_count_basis",
      )
      .eq("business_id", businessId)
      .eq("monthly_period_id", period.id),
  ]);

  if (revenueResult.error || expenseResult.error) {
    return (
      <div className={styles.page}>
        {correctionNavigation}
        {returnBanner}
        <div className={styles.errorStatus}>تعذر تحميل تفاصيل الشهر كاملة. لم يتم فتح نموذج التصحيح.</div>
      </div>
    );
  }

  const revenueEntries = revenueResult.data ?? [];
  const expenseEntries = expenseResult.data ?? [];
  const revenueEntryById = new Map(
    revenueEntries.map((entry) => [String(entry.revenue_stream_id), entry]),
  );
  const expenseEntryById = new Map(
    expenseEntries.map((entry) => [String(entry.expense_item_id), entry]),
  );

  const revenueRows: RevenueInputRow[] = (streamsResult.data ?? [])
    .filter((stream) => stream.is_active || revenueEntryById.has(stream.id))
    .map((stream) => {
      const entry = revenueEntryById.get(stream.id);
      return {
        id: stream.id,
        name: String(entry?.stream_name_snapshot ?? stream.name),
        streamType: String(entry?.stream_type_snapshot ?? stream.stream_type),
        active: stream.is_active,
        gross: asInputValue(entry?.gross_cash_collected),
        refunds: asInputValue(entry?.refunds),
      };
    });

  const expenseRows: ExpenseInputRow[] = (expensesResult.data ?? [])
    .filter((expense) => expense.is_active || expenseEntryById.has(expense.id))
    .map((expense) => {
      const entry = expenseEntryById.get(expense.id);
      const behavior = String(entry?.cost_behavior_snapshot ?? expense.cost_behavior);
      return {
        id: expense.id,
        name: String(entry?.expense_name_snapshot ?? expense.name),
        category: String(entry?.category_snapshot ?? expense.category),
        behavior,
        active: expense.is_active,
        value: storedExpenseValueForDisplay(
          entry?.input_value as string | number | null | undefined,
          behavior,
        ),
        basis: String(entry?.customer_count_basis ?? ""),
      };
    });

  const payingCustomersDerived = customerCountsResult.available;
  const newCustomersDerived =
    customerCountsResult.available && customerCountsResult.counts.newCustomers !== null;
  const effectivePeriod: MonthlyPeriodValues = payingCustomersDerived
    ? {
        ...period,
        new_customers: newCustomersDerived
          ? customerCountsResult.counts.newCustomers
          : period.new_customers,
        total_paying_customers: customerCountsResult.counts.totalPayingCustomers,
      }
    : period;

  return (
    <div className={styles.page}>
      {correctionNavigation}
      {returnBanner}
      <div className={styles.headingRow}>
        <div>
          <span className={styles.eyebrow}>تصحيح تاريخي صريح</span>
          <h1>تصحيح بيانات شهر سابق</h1>
          <p>{business.name} · {selectedMonthLabel}</p>
        </div>
      </div>

      <div className={styles.warningPanel}>
        <strong>هذا ليس تعديلًا عاديًا على الإعدادات الحالية.</strong>
        <span>أي حفظ هنا يسجل سبب التصحيح ونسخة قبل وبعد. تعديل إعداد المصروف اليوم لا يعيد كتابة هذا الشهر بصمت.</span>
      </div>

      <form className={styles.monthPicker}>
        <HistoricalReturnFields returnOrigin={returnOrigin} />
        <label>
          <span>الشهر المراد تصحيحه</span>
          <input type="month" name="month" defaultValue={selectedMonth.monthKey} max={latestHistoricalMonth} />
        </label>
        <button type="submit">فتح الشهر</button>
      </form>

      {statusMessage && (
        <div className={statusIsError ? styles.errorStatus : styles.successStatus} role="status">
          {statusMessage}
        </div>
      )}

      <HistoricalCorrectionForm
        businessId={businessId}
        monthKey={selectedMonth.monthKey}
        monthLabel={selectedMonthLabel}
        currency={business.base_currency}
        revenueRows={revenueRows}
        expenseRows={expenseRows}
        period={effectivePeriod}
        canEdit={canManage}
        payingCustomersDerived={payingCustomersDerived}
        newCustomersDerived={newCustomersDerived}
        payingCustomersCount={
          payingCustomersDerived ? customerCountsResult.counts.totalPayingCustomers : null
        }
        returnOrigin={returnOrigin}
      />
    </div>
  );
}
