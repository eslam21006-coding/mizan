import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeading } from "@/components/page-heading";
import { requireAuthContext } from "@/lib/auth/context";
import { EXPENSE_CATEGORY_OPTIONS, EXPENSE_COST_BEHAVIOR_OPTIONS } from "@/lib/business/expenses";
import {
  currentMonthKeyForTimeZone,
  parseMonthKey,
  shiftMonthKey,
  storedExpenseValueForDisplay,
} from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { copyPreviousMonthExpenses, saveMonthlyActuals } from "./actions";
import styles from "./monthly.module.css";

type MonthlyPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ month?: string; status?: string; copied?: string }>;
};

type RevenueInputRow = {
  id: string;
  name: string;
  streamType: string;
  active: boolean;
  gross: string;
  refunds: string;
};

type ExpenseInputRow = {
  id: string;
  name: string;
  category: string;
  behavior: string;
  active: boolean;
  value: string;
  basis: string;
};

const EXPENSE_SECTIONS = [
  {
    category: "acquisition",
    title: "الاكتساب",
    description: "التسويق والمبيعات وكل تكلفة هدفها جلب عميل جديد.",
  },
  {
    category: "fulfillment",
    title: "التنفيذ وخدمة العملاء",
    description: "تكاليف تقديم الخدمة أو المنتج ومتابعة العملاء.",
  },
  {
    category: "overhead",
    title: "المصاريف التشغيلية العامة",
    description: "الإدارة والبرامج والإيجار والمحاسبة والتشغيل العام.",
  },
  {
    category: "financial",
    title: "المصاريف المالية",
    description: "رسوم بوابات الدفع والضرائب والمصاريف المالية الأخرى.",
  },
] as const;

const STATUS_MESSAGES: Record<string, string> = {
  saved: "تم حفظ بيانات الشهر.",
  "invalid-month": "صيغة الشهر غير صحيحة.",
  "invalid-input": "راجع القيم المدخلة. استخدم أرقامًا موجبة أو اترك القيمة فارغة إذا كانت غير متاحة.",
  "invalid-customers": "عدد العملاء الجدد لا يمكن أن يتجاوز إجمالي العملاء الدافعين.",
  "save-failed": "تعذر حفظ الشهر. لم يتم حفظ تعديل جزئي.",
  "copy-failed": "تعذر نسخ مصروفات الشهر السابق.",
  "no-previous": "لا توجد بيانات للشهر السابق لنسخها.",
};

function asInputValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function streamTypeLabel(value: string) {
  return value === "front_end" ? "Front-End" : "Backend";
}

function categoryLabel(value: string) {
  return EXPENSE_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function behaviorLabel(value: string) {
  return EXPENSE_COST_BEHAVIOR_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function basisLabel(value: string) {
  if (value === "new_customers") return "العملاء الجدد";
  if (value === "total_paying_customers") return "إجمالي العملاء الدافعين";
  return "غير محدد";
}

function InputField({
  editable,
  name,
  label,
  value,
  suffix,
  integer = false,
}: {
  editable: boolean;
  name: string;
  label: string;
  value: string;
  suffix?: string;
  integer?: boolean;
}) {
  if (!editable) {
    return (
      <div className={styles.readField}>
        <span>{label}</span>
        <strong dir="ltr">
          {value === "" ? "غير متاح" : `${value}${suffix ? ` ${suffix}` : ""}`}
        </strong>
      </div>
    );
  }

  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.inputShell}>
        <input
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          autoComplete="off"
          name={name}
          defaultValue={value}
          aria-label={label}
          dir="ltr"
        />
        {suffix && <small>{suffix}</small>}
      </div>
    </label>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function MonthlySections({
  editable,
  currency,
  revenueRows,
  expenseRows,
  period,
}: {
  editable: boolean;
  currency: string;
  revenueRows: RevenueInputRow[];
  expenseRows: ExpenseInputRow[];
  period: Record<string, unknown> | null;
}) {
  return (
    <>
      <Section
        eyebrow="1 / 7"
        title="الإيراد"
        description="سجل الكاش الذي تم تحصيله فعليًا قبل المرتجعات، وليس قيمة العقود المستقبلية."
      >
        {revenueRows.length > 0 ? (
          <div className={styles.rowList}>
            {revenueRows.map((row) => (
              <div className={styles.dataRow} key={`gross-${row.id}`}>
                {editable && <input type="hidden" name="revenue_stream_id" value={row.id} />}
                <div className={styles.rowIdentity}>
                  <strong>{row.name}</strong>
                  <div>
                    <span>{streamTypeLabel(row.streamType)}</span>
                    {!row.active && <span className={styles.inactiveBadge}>غير نشط حاليًا</span>}
                  </div>
                </div>
                <InputField
                  editable={editable}
                  name={`gross_${row.id}`}
                  label={`الإيراد المحصل — ${row.name}`}
                  value={row.gross}
                  suffix={currency}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyText}>لا توجد مصادر إيراد نشطة لهذا الشهر.</p>
        )}

        <div className={styles.manualBox}>
          <InputField
            editable={editable}
            name="unallocated_gross"
            label="إيراد محصل غير موزع على مصدر"
            value={asInputValue(period?.unallocated_gross_cash_collected)}
            suffix={currency}
          />
          {editable ? (
            <label className={styles.field}>
              <span>ملاحظة على المبالغ غير الموزعة</span>
              <textarea
                name="adjustment_note"
                maxLength={500}
                defaultValue={asInputValue(period?.adjustment_note)}
                aria-label="ملاحظة على المبالغ غير الموزعة"
              />
            </label>
          ) : (
            <div className={styles.readField}>
              <span>ملاحظة على المبالغ غير الموزعة</span>
              <strong>{asInputValue(period?.adjustment_note) || "لا توجد ملاحظة"}</strong>
            </div>
          )}
        </div>
      </Section>

      <Section
        eyebrow="2 / 7"
        title="المرتجعات"
        description="سجل المرتجعات كمبالغ موجبة. المرتجع يخفض الإيراد ولا يُسجل مرة ثانية كمصروف."
      >
        {revenueRows.length > 0 ? (
          <div className={styles.rowList}>
            {revenueRows.map((row) => (
              <div className={styles.dataRow} key={`refund-${row.id}`}>
                <div className={styles.rowIdentity}>
                  <strong>{row.name}</strong>
                  <span>{streamTypeLabel(row.streamType)}</span>
                </div>
                <InputField
                  editable={editable}
                  name={`refund_${row.id}`}
                  label={`المرتجعات — ${row.name}`}
                  value={row.refunds}
                  suffix={currency}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyText}>لا توجد مصادر إيراد نشطة لهذا الشهر.</p>
        )}
        <div className={styles.manualBox}>
          <InputField
            editable={editable}
            name="unallocated_refunds"
            label="مرتجعات غير موزعة على مصدر"
            value={asInputValue(period?.unallocated_refunds)}
            suffix={currency}
          />
        </div>
      </Section>

      <Section
        eyebrow="3 / 7"
        title="العملاء"
        description="اترك الحقل فارغًا إذا لم تكن تعرف الرقم. الصفر يعني أنك متأكد أن العدد صفر."
      >
        <div className={styles.twoColumn}>
          <InputField
            editable={editable}
            integer
            name="new_customers"
            label="عملاء جدد"
            value={asInputValue(period?.new_customers)}
          />
          <InputField
            editable={editable}
            integer
            name="total_paying_customers"
            label="إجمالي العملاء الدافعين"
            value={asInputValue(period?.total_paying_customers)}
          />
        </div>
        <p className={styles.helpText}>
          العملاء الجدد لا يمكن أن يكونوا أكثر من إجمالي العملاء الدافعين في نفس الشهر.
        </p>
      </Section>

      {EXPENSE_SECTIONS.map((section, index) => {
        const rows = expenseRows.filter((row) => row.category === section.category);
        return (
          <Section
            key={section.category}
            eyebrow={`${index + 4} / 7`}
            title={section.title}
            description={section.description}
          >
            {rows.length > 0 ? (
              <div className={styles.expenseList}>
                {rows.map((row) => {
                  const valueLabel =
                    row.behavior === "fixed_monthly"
                      ? `${row.name} — القيمة الشهرية`
                      : row.behavior === "per_customer"
                        ? `${row.name} — التكلفة لكل عميل`
                        : `${row.name} — النسبة %`;
                  const suffix = row.behavior === "percentage_revenue" ? "%" : currency;

                  return (
                    <div className={styles.expenseRow} key={row.id}>
                      {editable && <input type="hidden" name="expense_item_id" value={row.id} />}
                      <div className={styles.rowIdentity}>
                        <strong>{row.name}</strong>
                        <div>
                          <span>{categoryLabel(row.category)}</span>
                          <span>{behaviorLabel(row.behavior)}</span>
                          {!row.active && <span className={styles.inactiveBadge}>غير نشط حاليًا</span>}
                        </div>
                      </div>
                      <InputField
                        editable={editable}
                        name={`expense_value_${row.id}`}
                        label={valueLabel}
                        value={row.value}
                        suffix={suffix}
                      />
                      {row.behavior === "per_customer" &&
                        (editable ? (
                          <label className={styles.field}>
                            <span>{`أساس عدد العملاء — ${row.name}`}</span>
                            <select
                              name={`expense_basis_${row.id}`}
                              defaultValue={row.basis}
                              aria-label={`أساس عدد العملاء — ${row.name}`}
                              required
                            >
                              <option value="" disabled>
                                اختر أساس عدد العملاء
                              </option>
                              <option value="new_customers">العملاء الجدد</option>
                              <option value="total_paying_customers">إجمالي العملاء الدافعين</option>
                            </select>
                          </label>
                        ) : (
                          <div className={styles.readField}>
                            <span>أساس عدد العملاء</span>
                            <strong>{basisLabel(row.basis)}</strong>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.emptyText}>لا توجد بنود معرفة في هذا التصنيف لهذا الشهر.</p>
            )}
          </Section>
        );
      })}
    </>
  );
}

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
  const selectedMonth =
    parseMonthKey(query.month) ?? parseMonthKey(currentMonthKeyForTimeZone(business.timezone));
  if (!selectedMonth) notFound();

  const [periodResult, streamsResult, expensesResult] = await Promise.all([
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
    periodResult.error || streamsResult.error || expensesResult.error || entryLoadError,
  );
  const streams = streamsResult.data ?? [];
  const expenses = expensesResult.data ?? [];

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
      const category = String(entry?.category_snapshot ?? expense.category);
      const behavior = String(entry?.cost_behavior_snapshot ?? expense.cost_behavior);
      return {
        id: expense.id,
        name: String(entry?.expense_name_snapshot ?? expense.name),
        category,
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
  const canEditMonth = canManage && !dataLoadError;
  const previousMonth = shiftMonthKey(selectedMonth.monthKey, -1);
  const nextMonth = shiftMonthKey(selectedMonth.monthKey, 1);
  const monthLabel = new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${selectedMonth.monthStart}T00:00:00.000Z`));

  const copiedCount = Number(query.copied ?? 0);
  const statusMessage =
    query.status === "copied"
      ? `تم نسخ ${Number.isFinite(copiedCount) ? copiedCount : 0} بند مصروف من الشهر السابق.`
      : query.status
        ? STATUS_MESSAGES[query.status]
        : null;
  const isErrorStatus = Boolean(
    query.status && !["saved", "copied", "no-previous"].includes(query.status),
  );

  return (
    <div className="page-stack">
      <div className={styles.headingRow}>
        <PageHeading
          title="الإدخال الشهري"
          description={`أدخل الأرقام الفعلية لـ ${business.name}. ميزان لا يحسب مؤشرات الأداء في هذه الخطوة.`}
        />
        <Link className={styles.backLink} href="/businesses">
          العودة للبزنسات
        </Link>
      </div>

      <section className={styles.monthBar} aria-label="اختيار الشهر">
        {previousMonth && (
          <Link href={`/businesses/${businessId}/monthly?month=${previousMonth}`}>الشهر السابق</Link>
        )}
        <div className={styles.monthCenter}>
          <strong>{monthLabel}</strong>
          <span>{period ? "محفوظ" : "لم يُحفظ بعد"}</span>
        </div>
        {nextMonth && (
          <Link href={`/businesses/${businessId}/monthly?month=${nextMonth}`}>الشهر التالي</Link>
        )}
      </section>

      <form key={`month-picker-${selectedMonth.monthKey}`} className={styles.monthPicker}>
        <label>
          <span>الشهر</span>
          <input type="month" name="month" defaultValue={selectedMonth.monthKey} aria-label="الشهر" />
        </label>
        <button type="submit">فتح الشهر</button>
      </form>

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

      {!canManage && !dataLoadError && (
        <div className={styles.readOnlyNotice}>
          صلاحيتك في هذا البزنس للعرض فقط. يمكنك مراجعة الأرقام الشهرية بدون تعديلها.
        </div>
      )}

      {canEditMonth && (
        <div className={styles.actionStrip}>
          <form action={copyPreviousMonthExpenses}>
            <input type="hidden" name="business_id" value={businessId} />
            <input type="hidden" name="month" value={selectedMonth.monthKey} />
            <button type="submit" className={styles.secondaryButton}>
              نسخ مصروفات الشهر السابق
            </button>
          </form>
          <p>النسخ لا ينقل الإيراد أو المرتجعات أو أعداد العملاء، ولا يستبدل قيمة موجودة.</p>
        </div>
      )}

      {!dataLoadError &&
        (canManage ? (
          <form
            key={`monthly-form-${selectedMonth.monthKey}`}
            action={saveMonthlyActuals}
            className={styles.monthForm}
          >
            <input type="hidden" name="business_id" value={businessId} />
            <input type="hidden" name="month" value={selectedMonth.monthKey} />
            <MonthlySections
              editable
              currency={business.base_currency}
              revenueRows={revenueRows}
              expenseRows={expenseRows}
              period={period}
            />
            <div className={styles.saveBar}>
              <div>
                <strong>حفظ بيانات {monthLabel}</strong>
                <p>يتم حفظ الشهر كعملية واحدة. أي خطأ يمنع الحفظ الجزئي.</p>
              </div>
              <button type="submit">حفظ الشهر</button>
            </div>
          </form>
        ) : (
          <div key={`monthly-read-${selectedMonth.monthKey}`} className={styles.monthForm}>
            <MonthlySections
              editable={false}
              currency={business.base_currency}
              revenueRows={revenueRows}
              expenseRows={expenseRows}
              period={period}
            />
          </div>
        ))}

      <div className={styles.setupLinks}>
        <span>تحتاج بندًا غير موجود؟</span>
        <Link href={`/businesses/${businessId}/revenue-streams`}>إدارة مصادر الإيراد</Link>
        <Link href={`/businesses/${businessId}/expenses`}>إدارة هيكل المصروفات</Link>
      </div>
    </div>
  );
}
