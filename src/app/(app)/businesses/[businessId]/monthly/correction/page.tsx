import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { loadTransactionDerivedMonthlyCustomerCounts } from "@/lib/business/monthly-customer-counts";
import {
  currentMonthKeyForTimeZone,
  parseMonthKey,
  shiftMonthKey,
  storedExpenseValueForDisplay,
} from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ExpenseInputRow,
  MonthlyPeriodValues,
  RevenueInputRow,
} from "../monthly-entry-form";
import { HistoricalCorrectionForm } from "./historical-correction-form";
import styles from "./historical-correction.module.css";

type HistoricalCorrectionPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ month?: string; status?: string }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  corrected: "تم حفظ التصحيح التاريخي وتسجيل نسخة قبل وبعد مع سبب التعديل.",
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
  const currentMonthKey = currentMonthKeyForTimeZone(business.timezone);
  const latestHistoricalMonth = shiftMonthKey(currentMonthKey, -1) ?? currentMonthKey;
  const selectedMonth = parseMonthKey(query.month ?? latestHistoricalMonth);
  if (!selectedMonth) notFound();

  const statusMessage = query.status ? STATUS_MESSAGES[query.status] ?? null : null;
  const statusIsError = Boolean(query.status && query.status !== "corrected");
  const isHistorical = selectedMonth.monthKey < currentMonthKey;

  if (!isHistorical) {
    return (
      <div className={styles.page}>
        <div className={styles.headingRow}>
          <div>
            <span className={styles.eyebrow}>تصحيح تاريخي صريح</span>
            <h1>تصحيح بيانات شهر سابق</h1>
            <p>هذا المسار مخصص فقط لشهر أقدم من الشهر الحالي للبزنس.</p>
          </div>
          <Link className={styles.backLink} href={`/businesses/${businessId}/monthly`}>
            العودة للإدخال الشهري
          </Link>
        </div>
        <form className={styles.monthPicker}>
          <label>
            <span>اختر شهرًا سابقًا</span>
            <input type="month" name="month" defaultValue={latestHistoricalMonth} max={latestHistoricalMonth} />
          </label>
          <button type="submit">فتح الشهر</button>
        </form>
        <div className={styles.errorStatus}>اختر شهرًا قبل {currentMonthKey} لاستخدام مسار التصحيح التاريخي.</div>
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
        <div className={styles.headingRow}>
          <div>
            <span className={styles.eyebrow}>تصحيح تاريخي صريح</span>
            <h1>تصحيح بيانات شهر سابق</h1>
          </div>
          <Link className={styles.backLink} href={`/businesses/${businessId}/monthly`}>
            العودة للإدخال الشهري
          </Link>
        </div>
        <div className={styles.errorStatus}>تعذر تحميل بيانات الشهر كاملة. تم إيقاف التصحيح حتى لا يتم حفظ بيانات ناقصة.</div>
      </div>
    );
  }

  if (!period) {
    return (
      <div className={styles.page}>
        <div className={styles.headingRow}>
          <div>
            <span className={styles.eyebrow}>تصحيح تاريخي صريح</span>
            <h1>تصحيح بيانات شهر سابق</h1>
            <p>{business.name} · {monthLabel(selectedMonth.monthStart)}</p>
          </div>
          <Link className={styles.backLink} href={`/businesses/${businessId}/monthly`}>
            العودة للإدخال الشهري
          </Link>
        </div>
        <form className={styles.monthPicker}>
          <label>
            <span>الشهر المراد تصحيحه</span>
            <input type="month" name="month" defaultValue={selectedMonth.monthKey} max={latestHistoricalMonth} />
          </label>
          <button type="submit">فتح الشهر</button>
        </form>
        <section className={styles.emptyState}>
          <div>
            <span className={styles.eyebrow}>لا توجد نسخة تاريخية بعد</span>
            <h2>هذا الشهر لم يُحفظ من قبل</h2>
            <p>التصحيح التاريخي لا ينشئ شهرًا مفقودًا. أدخل الشهر أول مرة من مسار الإدخال الشهري العادي، وبعدها تصبح أي تعديلات لاحقة تصحيحًا تاريخيًا مسجلًا.</p>
          </div>
          <div className={styles.emptyActions}>
            <Link className={styles.monthlyLink} href={`/businesses/${businessId}/monthly?month=${selectedMonth.monthKey}`}>
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
      <div className={styles.headingRow}>
        <div>
          <span className={styles.eyebrow}>تصحيح تاريخي صريح</span>
          <h1>تصحيح بيانات شهر سابق</h1>
          <p>{business.name} · {monthLabel(selectedMonth.monthStart)}</p>
        </div>
        <Link className={styles.backLink} href={`/businesses/${businessId}/monthly?month=${selectedMonth.monthKey}`}>
          العودة لعرض الشهر
        </Link>
      </div>

      <div className={styles.warningPanel}>
        <strong>هذا ليس تعديلًا عاديًا على الإعدادات الحالية.</strong>
        <span>أي حفظ هنا يسجل سبب التصحيح ونسخة قبل وبعد. تعديل إعداد المصروف اليوم لا يعيد كتابة هذا الشهر بصمت.</span>
      </div>

      <form className={styles.monthPicker}>
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
        monthLabel={monthLabel(selectedMonth.monthStart)}
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
      />
    </div>
  );
}
