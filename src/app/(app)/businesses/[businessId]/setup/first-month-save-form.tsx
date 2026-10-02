"use client";

import { useActionState } from "react";
import { StableSubmitButton } from "@/components/stable-submit-button";
import type { FirstMonthSetupData } from "@/lib/business/first-month-setup";
import {
  saveFirstMonthSetup,
  type FirstMonthSaveState,
} from "./first-month-actions";
import { MonthlyEntryForm } from "../monthly/monthly-entry-form";
import styles from "./first-month-setup.module.css";

const initialState: FirstMonthSaveState = {
  attempt: 0,
  status: "idle",
  code: null,
  fieldErrors: {},
  draft: {},
};

type Props = {
  businessId: string;
  monthKey: string;
  currency: string;
  firstMonth: FirstMonthSetupData;
};

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "invalid-month": "الشهر المحدد غير صحيح.",
  "invalid-input": "راجع الحقول المحددة ثم حاول الحفظ مرة أخرى.",
  "invalid-customers": "راجع أعداد العملاء ثم حاول الحفظ.",
  "blank-month": "أدخل أرقامًا فعلية أو صفرًا مؤكدًا قبل الحفظ.",
  "save-failed": "تعذر حفظ الشهر. لم يتم تأكيد أي تغييرات جديدة؛ يمكنك المحاولة مرة أخرى.",
  "historical-required": "هذا الشهر محفوظ كتاريخ سابق؛ استخدم مسار التصحيح التاريخي بدلًا من الحفظ العادي.",
};

export function FirstMonthSaveForm({ businessId, monthKey, currency, firstMonth }: Props) {
  const [state, formAction] = useActionState(saveFirstMonthSetup, initialState);
  const draft = state.draft;
  const value = (key: string, fallback: string) =>
    Object.hasOwn(draft, key) ? draft[key] : fallback;
  const period = {
    ...(firstMonth.period ?? {}),
    new_customers: value("new_customers", String(firstMonth.period?.new_customers ?? "")),
    total_paying_customers: value(
      "total_paying_customers",
      String(firstMonth.period?.total_paying_customers ?? ""),
    ),
    unallocated_gross_cash_collected: value(
      "unallocated_gross",
      String(firstMonth.period?.unallocated_gross_cash_collected ?? ""),
    ),
    unallocated_refunds: value(
      "unallocated_refunds",
      String(firstMonth.period?.unallocated_refunds ?? ""),
    ),
    adjustment_note: value("adjustment_note", String(firstMonth.period?.adjustment_note ?? "")),
  };

  const revenueRows = firstMonth.revenueRows.map((row) => ({
    ...row,
    gross: value(`gross_${row.id}`, row.gross),
    refunds: value(`refund_${row.id}`, row.refunds),
  }));
  const expenseRows = firstMonth.expenseRows.map((row) => ({
    ...row,
    value: value(`expense_value_${row.id}`, row.value),
    basis: value(`expense_basis_${row.id}`, row.basis),
  }));

  return (
    <form action={formAction} className={styles.firstMonthForm}>
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="month" value={monthKey} />
      {state.status === "error" && (
        <div role="alert" className={styles.saveError}>
          <strong>{ERROR_MESSAGES[state.code ?? ""] ?? "تعذر حفظ الشهر. راجع البيانات وحاول مرة أخرى."}</strong>
          {Object.keys(state.fieldErrors).length > 0 && (
            <ul>
              {Object.entries(state.fieldErrors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <section className={styles.formPreview} aria-label="إدخال أول شهر">
        <MonthlyEntryForm
          key={state.attempt}
          editable
          currency={currency}
          revenueRows={revenueRows}
          expenseRows={expenseRows}
          period={period}
          customerCountsDerived={firstMonth.payingCustomersDerived}
          newCustomersDerived={firstMonth.newCustomersDerived}
          allowPartialExpenseBasis
          fieldErrors={state.fieldErrors}
        />
      </section>
      <div className={styles.saveBar}>
        <div>
          <strong>حفظ أرقام الشهر</strong>
          <p>يمكنك حفظ بيانات غير مكتملة والعودة إليها لاحقًا. الحفظ لا يعني اكتمال الإعداد.</p>
        </div>
        <StableSubmitButton pendingLabel="جارٍ حفظ الشهر…">حفظ الشهر</StableSubmitButton>
      </div>
    </form>
  );
}
