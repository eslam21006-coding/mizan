import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { ReadOnlyNotice } from "@/components/read-only-notice";
import mobileActionStyles from "@/components/mobile-editor-actions.module.css";
import { StableSubmitButton } from "@/components/stable-submit-button";
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
import { resolveHistoricalMonthlyUiState } from "@/lib/historical-month-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildTransactionImportHref } from "@/lib/transaction-import-navigation";
import { copyPreviousMonthExpenses, saveMonthlyActuals } from "./actions";
import { HistoricalCorrectionSuccess } from "./historical-correction-success";
import { HistoricalMonthState } from "./historical-month-state";
import trustStyles from "./customer-history-trust.module.css";
import {
  MonthlyEntryForm,
  type ExpenseInputRow,
  type MonthlyPeriodValues,
  type RevenueInputRow,
} from "./monthly-entry-form";
import { MonthlyNavigationShell } from "./monthly-navigation-shell";
import styles from "./monthly.module.css";

type MonthlyPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{
    month?: string;
    status?: string;
    copied?: string;
    origin?: string | string[];
    return_month?: string | string[];
    insight_rule?: string | string[];
    insight_subject?: string | string[];
    planner_step?: string | string[];
    planner_goal?: string | string[];
    planner_value?: string | string[];
  }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  saved: "تم حفظ بيانات الشهر.",
  "invalid-month": "صيغة الشهر غير صحيحة.",
  "invalid-input": "راجع القيم المدخلة. استخدم أرقامًا موجبة أو اترك القيمة فارغة إذا كانت غير متاحة.",
  "invalid-customers": "عدد العملاء الجدد لا يمكن أن يتجاوز إجمالي العملاء الذين دفعوا خلال الشهر.",
  "customer-count-load-failed": "تعذر التحقق من أعداد العملاء من سجل المعاملات. لم يتم حفظ الشهر حتى لا نستخدم أرقامًا غير مؤكدة.",
  "save-failed": "تعذر حفظ الشهر. لم يتم حفظ تعديل جزئي.",
  "copy-failed": "تعذر نسخ مصروفات الشهر السابق.",
  "no-previous": "لا توجد بيانات للشهر السابق لنسخها.",
};

/** Converts nullable persisted values into monthly-form text values. */
function asInputValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

/** Appends validated external Return context while keeping the selected Monthly month independent. */
function appendMonthlyReturnQuery(
  query: URLSearchParams,
  returnOrigin: MonthlyExternalReturnOrigin,
) {
  query.set("origin", returnOrigin.origin);
  if (
    (returnOrigin.origin === "customer-profitability" ||
      returnOrigin.origin === "insights") &&
    returnOrigin.month
  ) {
    query.set("return_month", returnOrigin.month);
  }
  if (returnOrigin.origin === "insights") {
    query.set("insight_rule", returnOrigin.ruleId);
    if (returnOrigin.subjectId) query.set("insight_subject", returnOrigin.subjectId);
  }
  if (returnOrigin.origin === "target-planner") {
    query.set("planner_step", returnOrigin.step);
    query.set("planner_goal", returnOrigin.goal);
    if (returnOrigin.value !== undefined) {
      query.set("planner_value", returnOrigin.value);
    }
  }
}

/** Appends the same external Return context as a nested Monthly-editor setup origin. */
function appendSetupUpstreamQuery(
  query: URLSearchParams,
  returnOrigin: MonthlyExternalReturnOrigin,
) {
  query.set("upstream_origin", returnOrigin.origin);
  if (
    (returnOrigin.origin === "customer-profitability" ||
      returnOrigin.origin === "insights") &&
    returnOrigin.month
  ) {
    query.set("upstream_month", returnOrigin.month);
  }
  if (returnOrigin.origin === "insights") {
    query.set("upstream_insight_rule", returnOrigin.ruleId);
    if (returnOrigin.subjectId) {
      query.set("upstream_insight_subject", returnOrigin.subjectId);
    }
  }
  if (returnOrigin.origin === "target-planner") {
    query.set("upstream_planner_step", returnOrigin.step);
    query.set("upstream_planner_goal", returnOrigin.goal);
    if (returnOrigin.value !== undefined) {
      query.set("upstream_planner_value", returnOrigin.value);
    }
  }
}

/** Renders hidden fields that preserve validated external Return metadata across Monthly forms. */
function MonthlyReturnOriginFields({
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
      {returnOrigin.origin === "target-planner" && (
        <>
          <input type="hidden" name="planner_step" value={returnOrigin.step} />
          <input type="hidden" name="planner_goal" value={returnOrigin.goal} />
          {returnOrigin.value !== undefined && (
            <input type="hidden" name="planner_value" value={returnOrigin.value} />
          )}
        </>
      )}
    </>
  );
}

/** Renders the business-scoped Monthly editor while keeping hierarchical Back separate from workflow Return. */
export default async function MonthlyPage({ params, searchParams }: MonthlyPageProps) {
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
  const selectedMonth =
    parseMonthKey(query.month) ?? parseMonthKey(currentMonthKey);
  if (!selectedMonth) notFound();

  const returnOrigin = parseMonthlyExternalReturnOrigin({
    origin: query.origin,
    month: query.return_month ?? query.month,
    insight_rule: query.insight_rule,
    insight_subject: query.insight_subject,
    planner_step: query.planner_step,
    planner_goal: query.planner_goal,
    planner_value: query.planner_value,
  });

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

  const period = periodResult.data;
  let revenueEntries: Array<Record<string, unknown>> = [];
  let expenseEntries: Array<Record<string, unknown>> = [];
  let entryLoadError = false;

  if (period?.id && !periodResult.error) {
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

    revenueEntries = revenueResult.data ?? [];
    expenseEntries = expenseResult.data ?? [];
    entryLoadError = Boolean(revenueResult.error || expenseResult.error);
  }

  const dataLoadError = Boolean(
    periodResult.error ||
      streamsResult.error ||
      expensesResult.error ||
      customerCountsResult.dataLoadError ||
      entryLoadError,
  );
  const streams = streamsResult.data ?? [];
  const expenses = expensesResult.data ?? [];
  const payingCustomersDerived = customerCountsResult.available;
  const newCustomersDerived =
    customerCountsResult.available && customerCountsResult.counts.newCustomers !== null;
  const effectivePeriod: MonthlyPeriodValues = payingCustomersDerived
    ? {
        ...(period ?? {}),
        new_customers: newCustomersDerived
          ? customerCountsResult.counts.newCustomers
          : period?.new_customers,
        total_paying_customers: customerCountsResult.counts.totalPayingCustomers,
      }
    : (period as MonthlyPeriodValues);

  const revenueEntryById = new Map(
    revenueEntries.map((entry) => [String(entry.revenue_stream_id), entry]),
  );
  const expenseEntryById = new Map(
    expenseEntries.map((entry) => [String(entry.expense_item_id), entry]),
  );

  const revenueRows: RevenueInputRow[] = streams
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

  const expenseRows: ExpenseInputRow[] = expenses
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

  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;
  const isHistorical = selectedMonth.monthKey < currentMonthKey;
  const {
    isSavedHistorical,
    canEditMonth,
    showCorrectionSuccess: isHistoricalCorrectionSuccess,
  } = resolveHistoricalMonthlyUiState({
    status: query.status,
    isHistorical,
    hasSavedPeriod: Boolean(period),
    canManage,
    dataLoadError,
  });
  const previousMonth = shiftMonthKey(selectedMonth.monthKey, -1);
  const nextMonth = shiftMonthKey(selectedMonth.monthKey, 1);
  const monthlyHref = (monthKey: string) => {
    const queryParams = new URLSearchParams({ month: monthKey });
    if (returnOrigin) appendMonthlyReturnQuery(queryParams, returnOrigin);
    return `/businesses/${businessId}/monthly?${queryParams.toString()}`;
  };
  const setupHref = (route: "revenue-streams" | "expenses") => {
    const queryParams = new URLSearchParams({
      origin: "monthly-editor",
      month: selectedMonth.monthKey,
    });
    if (returnOrigin) appendSetupUpstreamQuery(queryParams, returnOrigin);
    return `/businesses/${businessId}/${route}?${queryParams.toString()}`;
  };
  const monthLabel = new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${selectedMonth.monthStart}T00:00:00.000Z`));

  const copiedCount = Number(query.copied ?? 0);
  const statusMessage =
    isHistoricalCorrectionSuccess
      ? null
      : query.status === "copied"
        ? `تم نسخ ${Number.isFinite(copiedCount) ? copiedCount : 0} بند مصروف من الشهر السابق.`
        : query.status
          ? STATUS_MESSAGES[query.status]
          : null;
  const isErrorStatus = Boolean(
    query.status && !["saved", "copied", "no-previous"].includes(query.status),
  );

  const historyTrustNotice = payingCustomersDerived && !newCustomersDerived ? (
    <div className={trustStyles.trustNotice} role="status">
      <strong>إجمالي العملاء الذين دفعوا خلال الشهر محسوب تلقائيًا</strong>
      <span className={trustStyles.trustValue} dir="ltr">
        {customerCountsResult.counts.totalPayingCustomers}
      </span>
      <p>
        «العملاء الجدد» يظل إدخالًا يدويًا لأن ميزان لم يتلقَّ تأكيدًا بأن سجل المعاملات مرفوع من بداية البزنس. هذا يمنع اعتبار عميل قديم اشترى Upsell عميلًا جديدًا.
      </p>
      {canManage && (
        <Link
          className={trustStyles.trustLink}
          href={buildTransactionImportHref(businessId, {
            origin: "monthly-editor",
            month: selectedMonth.monthKey,
          })}
        >
          مراجعة وتأكيد اكتمال سجل المعاملات
        </Link>
      )}
    </div>
  ) : null;

  return (
    <div className="page-stack">
      <MonthlyNavigationShell
        businessId={businessId}
        businessName={business.name}
        baseCurrency={business.base_currency}
        timezone={business.timezone}
      />

      <PageHeading
        title="الإدخال الشهري"
        description={`أدخل الأرقام الفعلية لـ ${business.name}. هذه الصفحة للإدخال فقط، والنتائج تظهر بعد الحفظ في لوحة البزنس.`}
      />

      {returnOrigin && (
        <ReturnContextBanner
          purpose={
            returnOrigin.origin === "insights"
              ? "مراجعة وتحديث البيانات المرتبطة بهذه الملاحظة"
              : returnOrigin.origin === "target-planner"
                ? "البيانات الناقصة المطلوبة لإكمال خطة الوصول للهدف"
                : returnOrigin.origin === "customer-profitability"
                  ? "بيانات مطلوبة في ربحية العميل"
                  : "بيانات مطلوبة في تحليل العملاء"
          }
          origin={returnOrigin}
          context={{ businessId }}
          returnLabel={
            returnOrigin.origin === "insights"
              ? "العودة إلى الملاحظة"
              : returnOrigin.origin === "target-planner"
                ? "العودة إلى خطة الهدف"
                : returnOrigin.origin === "customer-profitability"
                  ? "العودة إلى ربحية العميل"
                  : "العودة إلى العملاء"
          }
          ariaLabel="سياق العودة من الإدخال الشهري"
        />
      )}

      <section className={styles.monthBar} aria-label="اختيار الشهر">
        {previousMonth ? (
          <Link
            className={styles.monthNavButton}
            href={monthlyHref(previousMonth)}
          >
            <span aria-hidden="true">→</span>
            <span>الشهر السابق</span>
          </Link>
        ) : (
          <span />
        )}
        <div className={styles.monthCenter}>
          <span className={styles.monthEyebrow}>الشهر الحالي في النموذج</span>
          <strong>{monthLabel}</strong>
          <div className={styles.monthStateRow}>
            {isSavedHistorical && (
              <span className={styles.historicalBadge}>شهر تاريخي</span>
            )}
            <span className={period ? styles.savedState : styles.unsavedState}>
              {period ? "محفوظ" : "لم يُحفظ بعد"}
            </span>
          </div>
        </div>
        {nextMonth ? (
          <Link
            className={styles.monthNavButton}
            href={monthlyHref(nextMonth)}
          >
            <span>الشهر التالي</span>
            <span aria-hidden="true">←</span>
          </Link>
        ) : (
          <span />
        )}
      </section>

      <form key={`month-picker-${selectedMonth.monthKey}`} className={styles.monthPicker}>
        <MonthlyReturnOriginFields returnOrigin={returnOrigin} />
        <label>
          <span>انتقل مباشرة إلى شهر</span>
          <input type="month" name="month" defaultValue={selectedMonth.monthKey} aria-label="الشهر" />
        </label>
        <button type="submit">فتح الشهر</button>
      </form>

      {isHistoricalCorrectionSuccess && (
        <HistoricalCorrectionSuccess monthLabel={monthLabel} />
      )}

      {statusMessage && (
        <div className={isErrorStatus ? styles.errorStatus : styles.successStatus} role="status">
          {statusMessage}
        </div>
      )}

      {dataLoadError && (
        <div className={styles.errorStatus} role="alert">
          تعذر تحميل بيانات الشهر كاملة. تم إيقاف التعديل والنسخ حتى لا يتم حفظ بيانات ناقصة.
        </div>
      )}

      {!dataLoadError && isSavedHistorical && (
        <HistoricalMonthState
          businessId={businessId}
          monthKey={selectedMonth.monthKey}
          monthLabel={monthLabel}
          canManage={canManage}
          returnOrigin={returnOrigin}
        />
      )}

      {!canManage && !dataLoadError && (
        <ReadOnlyNotice description="يمكنك مراجعة الأرقام الشهرية، لكن تعديل الشهر ونسخ المصروفات متاحان لمالك البزنس أو الأدمن." />
      )}

      {!dataLoadError && canManage && (
        <section className={styles.setupPanel} aria-label="إعداد الإدخال الشهري">
          <div className={styles.setupHeader}>
            <div>
              <span className="eyebrow">الإعداد قبل الإدخال</span>
              <h2>كل الخانات تأتي من إعداد البزنس</h2>
              <p>إذا كان مصدر إيراد أو مصروف ناقصًا، أضفه من هنا ثم ارجع لنفس الشهر.</p>
            </div>
            <div className={styles.setupStatusGrid}>
              <div className={revenueRows.length > 0 ? styles.setupStatusReady : styles.setupStatusMissing}>
                <strong>{revenueRows.length}</strong>
                <span>مصدر إيراد</span>
              </div>
              <div className={expenseRows.length > 0 ? styles.setupStatusReady : styles.setupStatusMissing}>
                <strong>{expenseRows.length}</strong>
                <span>بند مصروف</span>
              </div>
            </div>
          </div>
          <div className={styles.setupActions}>
            <Link
              className={styles.setupLinkButton}
              href={setupHref("revenue-streams")}
            >
              إدارة مصادر الإيراد
            </Link>
            <Link
              className={styles.setupLinkButton}
              href={setupHref("expenses")}
            >
              إدارة هيكل المصروفات
            </Link>
            {canEditMonth && (
              <form action={copyPreviousMonthExpenses}>
                <input type="hidden" name="business_id" value={businessId} />
                <input type="hidden" name="month" value={selectedMonth.monthKey} />
                <MonthlyReturnOriginFields returnOrigin={returnOrigin} />
                <StableSubmitButton
                  className={styles.secondaryButton}
                  pendingLabel="جارٍ نسخ المصروفات…"
                >
                  نسخ مصروفات الشهر السابق
                </StableSubmitButton>
              </form>
            )}
          </div>
          <p className={styles.copyHint}>
            النسخ ينقل المصروفات فقط، ولا ينقل الإيراد أو المرتجعات أو أعداد العملاء، ولا يستبدل قيمة موجودة.
          </p>
        </section>
      )}

      {!dataLoadError &&
        (canManage && !isSavedHistorical ? (
          <form
            key={`monthly-form-${selectedMonth.monthKey}`}
            action={saveMonthlyActuals}
            className={`${styles.monthForm} ${mobileActionStyles.editorSurface} ${payingCustomersDerived && !newCustomersDerived ? trustStyles.payingDerivedOnly : ""}`}
          >
            <input type="hidden" name="business_id" value={businessId} />
            <input type="hidden" name="month" value={selectedMonth.monthKey} />
            <MonthlyReturnOriginFields returnOrigin={returnOrigin} />
            {historyTrustNotice}
            <MonthlyEntryForm
              editable
              currency={business.base_currency}
              revenueRows={revenueRows}
              expenseRows={expenseRows}
              period={effectivePeriod}
              customerCountsDerived={newCustomersDerived}
            />
            <div className={`${styles.saveBar} ${mobileActionStyles.actionBar}`} data-editor-action-bar="monthly">
              <div>
                <strong>حفظ أرقام {monthLabel}</strong>
                <p>يتم حفظ الشهر كعملية واحدة. أي خطأ يمنع الحفظ الجزئي.</p>
              </div>
              <StableSubmitButton pendingLabel="جارٍ حفظ الشهر…">حفظ الشهر</StableSubmitButton>
            </div>
          </form>
        ) : (
          <div key={`monthly-read-${selectedMonth.monthKey}`} className={`${styles.monthForm} ${mobileActionStyles.editorSurface}`}>
            {historyTrustNotice}
            <MonthlyEntryForm
              editable={false}
              currency={business.base_currency}
              revenueRows={revenueRows}
              expenseRows={expenseRows}
              period={effectivePeriod}
              customerCountsDerived={newCustomersDerived}
            />
            <div
              className={`${styles.saveBar} ${mobileActionStyles.actionBar} ${mobileActionStyles.readOnlyAction}`}
              data-editor-action-bar="monthly-read-only"
              aria-label="حالة إجراءات الإدخال الشهري"
            >
              <div>
                <strong>عرض فقط</strong>
                <p>حفظ الشهر متاح لمالك البزنس أو الأدمن.</p>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
