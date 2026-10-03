"use client";

import { useActionState, type ReactNode } from "react";
import mobileActionStyles from "@/components/mobile-editor-actions.module.css";
import trustStyles from "./customer-history-trust.module.css";
import { StableSubmitButton } from "@/components/stable-submit-button";
import type {
  ExpenseInputRow,
  MonthlyPeriodValues,
  RevenueInputRow,
} from "@/lib/business/monthly-entry-rows";
import {
  saveMonthlyActualsWithState,
  type MonthlySaveFormState,
} from "./actions";
import { MonthlyEntryForm } from "./monthly-entry-form";
import styles from "./monthly.module.css";

const initialState: MonthlySaveFormState = {
  attempt: 0,
  status: "idle",
  code: null,
  fieldErrors: {},
  draft: {},
};

const errorMessages: Readonly<Record<string, string>> = {
  "invalid-input": "راجع الحقول المحددة. يمكن كتابة 9336.28 أو 9,336.28، لكن فواصل الآلاف لازم تكون صحيحة.",
  "invalid-customers": "العملاء الجدد لا يمكن أن يزيدوا عن إجمالي العملاء الدافعين.",
  "blank-month": "أدخل قيمة مؤكدة واحدة على الأقل قبل الحفظ.",
  "save-failed": "تعذر حفظ الشهر. لم يتم تغيير أي بيانات.",
};

type Props = {
  businessId: string;
  monthKey: string;
  monthLabel: string;
  currency: string;
  revenueRows: RevenueInputRow[];
  expenseRows: ExpenseInputRow[];
  period: MonthlyPeriodValues;
  customerCountsDerived: boolean;
  newCustomersDerived: boolean;
  returnFields: ReactNode;
  historyTrustNotice: ReactNode;
};

/** Preserves submitted values and points to invalid fields without creating a partial saved month. */
export function MonthlySaveForm({
  businessId,
  monthKey,
  monthLabel,
  currency,
  revenueRows,
  expenseRows,
  period: savedPeriod,
  customerCountsDerived,
  newCustomersDerived,
  returnFields,
  historyTrustNotice,
}: Props) {
  const [state, formAction] = useActionState(saveMonthlyActualsWithState, initialState);
  const value = (key: string, fallback: string) =>
    Object.hasOwn(state.draft, key) ? state.draft[key] : fallback;
  const period: MonthlyPeriodValues = {
    ...(savedPeriod ?? {}),
    new_customers: value("new_customers", String(savedPeriod?.new_customers ?? "")),
    total_paying_customers: value(
      "total_paying_customers",
      String(savedPeriod?.total_paying_customers ?? ""),
    ),
    unallocated_gross_cash_collected: value(
      "unallocated_gross",
      String(savedPeriod?.unallocated_gross_cash_collected ?? ""),
    ),
    unallocated_refunds: value(
      "unallocated_refunds",
      String(savedPeriod?.unallocated_refunds ?? ""),
    ),
    adjustment_note: value("adjustment_note", String(savedPeriod?.adjustment_note ?? "")),
  };
  const retainedRevenueRows = revenueRows.map((row) => ({
    ...row,
    gross: value(`gross_${row.id}`, row.gross),
    refunds: value(`refund_${row.id}`, row.refunds),
  }));
  const retainedExpenseRows = expenseRows.map((row) => ({
    ...row,
    value: value(`expense_value_${row.id}`, row.value),
    basis: value(`expense_basis_${row.id}`, row.basis),
  }));
  return (
    <form
      action={formAction}
      className={`${styles.monthForm} ${mobileActionStyles.editorSurface} ${
        customerCountsDerived && !newCustomersDerived ? trustStyles.payingDerivedOnly : ""
      }`}
    >
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="month" value={monthKey} />
      {returnFields}
      {historyTrustNotice}
      {state.status === "error" && (
        <div className={styles.errorStatus} role="alert">
          <strong>
            {errorMessages[state.code ?? ""] ?? "راجع الحقول المحددة ثم حاول الحفظ مجددًا."}
          </strong>
          {Object.keys(state.fieldErrors).length > 0 && (
            <ul>
              {Object.entries(state.fieldErrors).map(([key, message]) => (
                <li key={key}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <MonthlyEntryForm
        key={state.attempt}
        editable
        currency={currency}
        revenueRows={retainedRevenueRows}
        expenseRows={retainedExpenseRows}
        period={period}
        customerCountsDerived={customerCountsDerived}
        newCustomersDerived={newCustomersDerived}
        fieldErrors={state.fieldErrors}
      />
      <div className={`${styles.saveBar} ${mobileActionStyles.actionBar}`} data-editor-action-bar="monthly">
        <div>
          <strong>حفظ أرقام {monthLabel}</strong>
          <p>يتم حفظ الشهر كعملية واحدة. أي خطأ يمنع الحفظ الجزئي ويحافظ على القيم المدخلة.</p>
        </div>
        <StableSubmitButton pendingLabel="جارٍ حفظ الشهر…">حفظ الشهر</StableSubmitButton>
      </div>
    </form>
  );
}
