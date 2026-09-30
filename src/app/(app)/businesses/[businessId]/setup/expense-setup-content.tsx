"use client";

import { useState } from "react";
import {
  EXPENSE_COST_BEHAVIOR_OPTIONS,
  EXPENSE_SETUP_CATEGORY_OPTIONS,
  type ExpenseCategory,
  type ExpenseCategoryCounts,
  type SetupExpenseItem,
} from "@/lib/business/expenses";
import { ExpenseDrawerLauncher } from "../expenses/expense-drawer";
import styles from "./business-setup-shell.module.css";

const EMPTY_NONE_SELECTION: Record<ExpenseCategory, boolean> = {
  acquisition: false,
  fulfillment: false,
  overhead: false,
  financial: false,
};

const EXPENSE_STATUS_MESSAGES: Readonly<
  Record<string, { tone: "success" | "error"; text: string }>
> = {
  created: {
    tone: "success",
    text: "تمت إضافة المصروف. راجع بقية الأنواع قبل تأكيد إعداد المصروفات.",
  },
  invalid: {
    tone: "error",
    text: "راجع بيانات المصروف وحاول مرة أخرى.",
  },
  "create-failed": {
    tone: "error",
    text: "تعذر إضافة المصروف. لم يتم تغيير أي بيانات.",
  },
};

type ExpenseSetupContentProps = {
  businessId: string;
  canManage: boolean;
  stepComplete: boolean;
  expenseItems: SetupExpenseItem[];
  activeExpenseCategoryCounts: ExpenseCategoryCounts;
  creationRequestId: string | null;
  status: string | null;
};

/** Renders B07's founder-facing expense categories without changing canonical expense behavior. */
export function ExpenseSetupContent({
  businessId,
  canManage,
  stepComplete,
  expenseItems,
  activeExpenseCategoryCounts,
  creationRequestId,
  status,
}: ExpenseSetupContentProps) {
  const [noneSelected, setNoneSelected] =
    useState<Record<ExpenseCategory, boolean>>(EMPTY_NONE_SELECTION);
  const statusMessage = status ? EXPENSE_STATUS_MESSAGES[status] : undefined;

  function toggleNone(category: ExpenseCategory) {
    setNoneSelected((current) => ({
      ...current,
      [category]: !current[category],
    }));
  }

  return (
    <>
      <div className={styles.expenseSetupIntro}>
        <h3>راجع أين يذهب المال في البزنس</h3>
        <p>
          راجع الأنواع الأربعة وأضف المصروفات الموجودة عندك. إذا لم يكن لديك مصروف من نوع
          معيّن، حدّد ذلك صراحة.
        </p>
      </div>

      {statusMessage ? (
        <div
          className={
            statusMessage.tone === "success" ? styles.setupSuccess : styles.setupError
          }
          role="status"
        >
          {statusMessage.text}
        </div>
      ) : null}

      {!canManage ? (
        <p className={styles.readOnlySetupNote}>
          يمكنك مراجعة المصروفات الحالية، لكن الإضافة أو تحديد عدم وجود مصروف متاحان لمالك
          البزنس أو الأدمن.
        </p>
      ) : null}

      <div className={styles.expenseCategoryGrid}>
        {EXPENSE_SETUP_CATEGORY_OPTIONS.map((category) => {
          const categoryItems = expenseItems.filter(
            (expense) => expense.category === category.value,
          );
          const activeCount = activeExpenseCategoryCounts[category.value];
          const canDeclareNone = activeCount === 0;
          const noneIsSelected = noneSelected[category.value];

          return (
            <section
              className={styles.expenseCategoryCard}
              key={category.value}
              aria-labelledby={`setup-expense-${category.value}`}
            >
              <div className={styles.expenseCategoryHeader}>
                <div>
                  <h3 id={`setup-expense-${category.value}`}>{category.label}</h3>
                  <p>{category.description}</p>
                </div>
                <span className={styles.expenseActiveCount}>{activeCount} نشط</span>
              </div>

              <ul className={styles.expenseExamples} aria-label={`أمثلة ${category.label}`}>
                {category.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>

              {categoryItems.length > 0 ? (
                <ul className={styles.expenseSetupList}>
                  {categoryItems.map((expense) => (
                    <li className={styles.expenseSetupItem} key={expense.id}>
                      <span className={styles.expenseSetupName}>{expense.name}</span>
                      {!expense.isActive ? (
                        <span className={styles.inactiveSourceBadge}>غير نشط</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.expenseCategoryEmpty}>
                  لا توجد مصروفات مضافة في هذا النوع.
                </p>
              )}

              <div className={styles.expenseCategoryActions}>
                {canManage && creationRequestId ? (
                  <ExpenseDrawerLauncher
                    businessId={businessId}
                    returnOrigin={null}
                    categoryOptions={EXPENSE_SETUP_CATEGORY_OPTIONS}
                    behaviorOptions={EXPENSE_COST_BEHAVIOR_OPTIONS}
                    mode="create"
                    creationRequestId={creationRequestId}
                    destination="setup"
                    fixedCategory={category.value}
                  />
                ) : null}

                {canManage && canDeclareNone ? (
                  <label
                    className={[
                      styles.expenseNoneChoice,
                      noneIsSelected ? styles.expenseNoneChoiceSelected : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={noneIsSelected}
                      onChange={() => toggleNone(category.value)}
                    />
                    <span>ليس لدي مصروف من هذا النوع</span>
                  </label>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {canManage && !stepComplete ? (
        <p className={styles.expenseSetupPendingNote}>
          هذه الاختيارات مؤقتة في هذه المرحلة. تأكيد مراجعة الأنواع الأربعة سيتم توصيله في
          المهمة التالية من B07.
        </p>
      ) : null}
    </>
  );
}
