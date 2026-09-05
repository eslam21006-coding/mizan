"use client";

import { useMemo, useState } from "react";
import styles from "./monthly.module.css";

export type RevenueInputRow = {
  id: string;
  name: string;
  streamType: string;
  active: boolean;
  gross: string;
  refunds: string;
};

export type ExpenseInputRow = {
  id: string;
  name: string;
  category: string;
  behavior: string;
  active: boolean;
  value: string;
  basis: string;
};

export type MonthlyPeriodValues = {
  new_customers?: unknown;
  total_paying_customers?: unknown;
  unallocated_gross_cash_collected?: unknown;
  unallocated_refunds?: unknown;
  adjustment_note?: unknown;
} | null;

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

function asInputValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function streamTypeLabel(value: string) {
  if (value === "front_end") return "Front-End";
  if (value === "backend") return "Backend";
  if (value === "other") return "Other";
  return value;
}

function categoryLabel(value: string) {
  if (value === "acquisition") return "اكتساب";
  if (value === "fulfillment") return "تنفيذ";
  if (value === "overhead") return "تشغيل عام";
  if (value === "financial") return "مالي";
  return value;
}

function behaviorLabel(value: string) {
  if (value === "fixed_monthly") return "مبلغ شهري ثابت";
  if (value === "per_customer") return "لكل عميل";
  if (value === "percentage_revenue") return "% من الإيراد";
  return value;
}

function basisLabel(value: string) {
  if (value === "new_customers") return "العملاء الجدد";
  if (value === "total_paying_customers") return "إجمالي العملاء الدافعين";
  return "غير محدد";
}

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value) + ` ${currency}`;
}

function NetValue({ gross, refunds, currency }: { gross: string; refunds: string; currency: string }) {
  const net = useMemo(() => {
    const grossValue = parseNumber(gross);
    const refundValue = parseNumber(refunds);
    if (grossValue === null || refundValue === null) return null;
    return grossValue - refundValue;
  }, [gross, refunds]);

  return (
    <div className={styles.netCell}>
      <span>الصافي</span>
      <strong dir="ltr">{net === null ? "—" : formatMoney(net, currency)}</strong>
      {net === null && <small>أدخل المحصل والمرتجعات لإظهار الصافي.</small>}
    </div>
  );
}

function InputField({
  editable,
  name,
  label,
  value,
  suffix,
  integer = false,
  onValueChange,
}: {
  editable: boolean;
  name: string;
  label: string;
  value: string;
  suffix?: string;
  integer?: boolean;
  onValueChange?: (value: string) => void;
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
          value={onValueChange ? value : undefined}
          defaultValue={onValueChange ? undefined : value}
          onChange={onValueChange ? (event) => onValueChange(event.currentTarget.value) : undefined}
          aria-label={label}
          dir="ltr"
        />
        {suffix && <small>{suffix}</small>}
      </div>
    </label>
  );
}

function SectionHeading({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className={styles.sectionHeading}>
      <span>{step}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function RevenueSection({
  editable,
  currency,
  revenueRows,
  period,
}: {
  editable: boolean;
  currency: string;
  revenueRows: RevenueInputRow[];
  period: MonthlyPeriodValues;
}) {
  const [revenueValues, setRevenueValues] = useState(() =>
    Object.fromEntries(
      revenueRows.map((row) => [row.id, { gross: row.gross, refunds: row.refunds }]),
    ),
  );

  function setRevenueValue(id: string, key: "gross" | "refunds", value: string) {
    setRevenueValues((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? { gross: "", refunds: "" }),
        [key]: value,
      },
    }));
  }

  return (
    <section className={styles.section}>
      <SectionHeading
        step="1 / 3"
        title="الإيرادات والمرتجعات"
        description="أدخل الكاش المحصل فعليًا والمرتجعات لكل مصدر في نفس الصف. المرتجعات تخفض الإيراد ولا تُسجل كمصروف."
      />

      {revenueRows.length > 0 ? (
        <div className={styles.revenueTable} role="table" aria-label="الإيرادات والمرتجعات حسب المصدر">
          <div className={styles.revenueHeader} role="row">
            <span>مصدر الإيراد</span>
            <span>المحصل</span>
            <span>المرتجعات</span>
            <span>الصافي</span>
          </div>
          {revenueRows.map((row) => {
            const current = revenueValues[row.id] ?? { gross: row.gross, refunds: row.refunds };
            return (
              <div className={styles.revenueRow} role="row" key={row.id}>
                {editable && <input type="hidden" name="revenue_stream_id" value={row.id} />}
                <div className={styles.rowIdentity} role="cell">
                  <strong>{row.name}</strong>
                  <div>
                    <span>{streamTypeLabel(row.streamType)}</span>
                    {!row.active && <span className={styles.inactiveBadge}>غير نشط حاليًا</span>}
                  </div>
                </div>
                <div role="cell">
                  <InputField
                    editable={editable}
                    name={`gross_${row.id}`}
                    label={`الإيراد المحصل — ${row.name}`}
                    value={editable ? current.gross : row.gross}
                    suffix={currency}
                    onValueChange={editable ? (value) => setRevenueValue(row.id, "gross", value) : undefined}
                  />
                </div>
                <div role="cell">
                  <InputField
                    editable={editable}
                    name={`refund_${row.id}`}
                    label={`المرتجعات — ${row.name}`}
                    value={editable ? current.refunds : row.refunds}
                    suffix={currency}
                    onValueChange={editable ? (value) => setRevenueValue(row.id, "refunds", value) : undefined}
                  />
                </div>
                <div role="cell">
                  <NetValue gross={current.gross} refunds={current.refunds} currency={currency} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <strong>لم تضف مصادر إيراد بعد.</strong>
          <p>أضف مصادر الإيراد أولًا حتى تظهر هنا كصفوف واضحة للإدخال.</p>
        </div>
      )}

      <div className={styles.unallocatedBox}>
        <div className={styles.unallocatedHeading}>
          <strong>مبالغ غير مرتبطة بمصدر محدد</strong>
          <span>اختياري</span>
        </div>
        <p>استخدم هذه الخانات فقط عندما توجد مبالغ حقيقية لا تستطيع ربطها بأي مصدر إيراد.</p>
        <div className={styles.unallocatedGrid}>
          <InputField
            editable={editable}
            name="unallocated_gross"
            label="إيراد محصل غير موزع على مصدر"
            value={asInputValue(period?.unallocated_gross_cash_collected)}
            suffix={currency}
          />
          <InputField
            editable={editable}
            name="unallocated_refunds"
            label="مرتجعات غير موزعة على مصدر"
            value={asInputValue(period?.unallocated_refunds)}
            suffix={currency}
          />
        </div>
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
    </section>
  );
}

function CustomersSection({ editable, period }: { editable: boolean; period: MonthlyPeriodValues }) {
  return (
    <section className={styles.section}>
      <SectionHeading
        step="2 / 3"
        title="العملاء"
        description="اترك الحقل فارغًا إذا لم تكن تعرف الرقم. الصفر يعني أنك متأكد أن العدد صفر."
      />
      <div className={styles.customerGrid}>
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
    </section>
  );
}

function ExpenseValueField({
  editable,
  row,
  currency,
}: {
  editable: boolean;
  row: ExpenseInputRow;
  currency: string;
}) {
  const valueLabel =
    row.behavior === "fixed_monthly"
      ? `${row.name} — القيمة الشهرية`
      : row.behavior === "per_customer"
        ? `${row.name} — التكلفة لكل عميل`
        : `${row.name} — النسبة %`;
  const suffix = row.behavior === "percentage_revenue" ? "%" : currency;

  return (
    <InputField
      editable={editable}
      name={`expense_value_${row.id}`}
      label={valueLabel}
      value={row.value}
      suffix={suffix}
    />
  );
}

function ExpenseCalculation({ editable, row }: { editable: boolean; row: ExpenseInputRow }) {
  if (row.behavior === "fixed_monthly") {
    return (
      <div className={styles.calculationBox}>
        <span className={styles.manualBadge}>إدخال يدوي</span>
        <strong>المبلغ الذي تدخله هو تكلفة الشهر.</strong>
      </div>
    );
  }

  if (row.behavior === "percentage_revenue") {
    return (
      <div className={styles.calculationBox}>
        <span className={styles.autoBadge}>الإجمالي محسوب تلقائيًا</span>
        <strong>النسبة × صافي الإيراد المحصل</strong>
      </div>
    );
  }

  if (!editable) {
    return (
      <div className={styles.calculationBox}>
        <span className={styles.autoBadge}>الإجمالي محسوب تلقائيًا</span>
        <strong>التكلفة لكل عميل × {basisLabel(row.basis)}</strong>
      </div>
    );
  }

  return (
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
      <small className={styles.autoHint}>الإجمالي = التكلفة لكل عميل × العدد المختار.</small>
    </label>
  );
}

function ExpensesSection({
  editable,
  currency,
  expenseRows,
}: {
  editable: boolean;
  currency: string;
  expenseRows: ExpenseInputRow[];
}) {
  const configuredSections = EXPENSE_SECTIONS.map((section) => ({
    ...section,
    rows: expenseRows.filter((row) => row.category === section.category),
  })).filter((section) => section.rows.length > 0);

  return (
    <section className={styles.section}>
      <SectionHeading
        step="3 / 3"
        title="المصاريف"
        description="أدخل المبلغ أو المعدل فقط. ميزان يميز بوضوح بين ما تدخله يدويًا وما يتم حساب إجماليه تلقائيًا."
      />

      {configuredSections.length > 0 ? (
        <div className={styles.expenseGroups}>
          {configuredSections.map((section) => (
            <div className={styles.expenseGroup} key={section.category}>
              <div className={styles.expenseGroupHeading}>
                <div>
                  <h3>{section.title}</h3>
                  <p>{section.description}</p>
                </div>
                <span>{section.rows.length} بند</span>
              </div>
              <div className={styles.expenseList}>
                {section.rows.map((row) => (
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
                    <ExpenseValueField editable={editable} row={row} currency={currency} />
                    <ExpenseCalculation editable={editable} row={row} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <strong>لم تضف بنود مصروفات بعد.</strong>
          <p>هيكل المصروفات يحدد الخانات التي ستظهر هنا كل شهر.</p>
        </div>
      )}
    </section>
  );
}

export function MonthlyEntryForm({
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
  period: MonthlyPeriodValues;
}) {
  return (
    <>
      <RevenueSection
        editable={editable}
        currency={currency}
        revenueRows={revenueRows}
        period={period}
      />
      <CustomersSection editable={editable} period={period} />
      <ExpensesSection editable={editable} currency={currency} expenseRows={expenseRows} />
    </>
  );
}
