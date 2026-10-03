"use client";

import { useState } from "react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  EXPENSE_COST_BEHAVIOR_OPTIONS,
  EXPENSE_SETUP_CATEGORY_OPTIONS,
  type ExpenseCategory,
  type ExpenseCategoryCounts,
  type ExpenseCreationRequestIds,
  type SetupExpenseItem,
} from "@/lib/business/expenses";
import { ExpenseDrawerLauncher } from "../expenses/expense-drawer";
import { deleteExpenseItem } from "../expenses/actions";
import { confirmExpenseSetupReview } from "./actions";
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
  updated: {
    tone: "success",
    text: "تم تحديث المصروف. راجع الأنواع الأربعة قبل تأكيد الإعداد.",
  },
  deleted: {
    tone: "success",
    text: "تم حذف المصروف غير المستخدم. راجع بقية الأنواع قبل تأكيد الإعداد.",
  },
  "in-use": {
    tone: "error",
    text: "لا يمكن حذف هذا المصروف لأنه مرتبط ببيانات محفوظة. اضغط «تعديل» وعطّله بدل الحذف للحفاظ على التاريخ.",
  },
  "update-failed": {
    tone: "error",
    text: "تعذر تحديث المصروف. لم يتم تغيير أي بيانات.",
  },
  "delete-failed": {
    tone: "error",
    text: "تعذر حذف المصروف. لم يتم تغيير أي بيانات.",
  },
  invalid: {
    tone: "error",
    text: "راجع بيانات المصروف وحاول مرة أخرى.",
  },
  "create-failed": {
    tone: "error",
    text: "تعذر إضافة المصروف. لم يتم تغيير أي بيانات.",
  },
  reviewed: {
    tone: "success",
    text: "تم تأكيد مراجعة المصروفات. يمكنك الانتقال إلى الخطوة التالية.",
  },
  "review-incomplete": {
    tone: "error",
    text: "راجع الأنواع الأربعة. أضف مصروفًا أو اختر «ليس لدي مصروف من هذا النوع» لكل نوع فارغ.",
  },
  "review-failed": {
    tone: "error",
    text: "تعذر تأكيد مراجعة المصروفات. لم يتم تغيير حالة الإعداد.",
  },
};

type ExpenseSetupContentProps = {
  businessId: string;
  canManage: boolean;
  stepComplete: boolean;
  expenseItems: SetupExpenseItem[];
  activeExpenseCategoryCounts: ExpenseCategoryCounts;
  creationRequestIds: ExpenseCreationRequestIds | null;
  status: string | null;
};

/** Renders B07's founder-facing expense categories without changing canonical expense behavior. */
export function ExpenseSetupContent({
  businessId,
  canManage,
  stepComplete,
  expenseItems,
  activeExpenseCategoryCounts,
  creationRequestIds,
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
          const canDeclareNone = activeCount === 0 && !stepComplete;
          const noneIsSelected = noneSelected[category.value];
          const reviewedNone = stepComplete && activeCount === 0;

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
                      {canManage ? (
                        <div className={styles.expenseItemActions}>
                          <ExpenseDrawerLauncher
                            businessId={businessId}
                            returnOrigin={null}
                            categoryOptions={EXPENSE_SETUP_CATEGORY_OPTIONS}
                            behaviorOptions={EXPENSE_COST_BEHAVIOR_OPTIONS}
                            mode="edit"
                            destination="setup"
                            expense={{
                              id: expense.id,
                              name: expense.name,
                              category: expense.category,
                              cost_behavior: expense.costBehavior,
                              is_active: expense.isActive,
                            }}
                          />
                          <form action={deleteExpenseItem}>
                            <input type="hidden" name="business_id" value={businessId} />
                            <input type="hidden" name="expense_id" value={expense.id} />
                            <input type="hidden" name="destination" value="setup" />
                            <ConfirmSubmitButton
                              className={styles.expenseDeleteButton}
                              ariaLabel={`حذف المصروف ${expense.name}`}
                              confirmMessage={`هل تريد حذف المصروف «${expense.name}»؟ إذا كان مرتبطًا ببيانات سابقة، سيمنع ميزان الحذف ويمكنك تعطيله بدلًا من ذلك.`}
                            >
                              حذف
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.expenseCategoryEmpty}>
                  لا توجد مصروفات مضافة في هذا النوع.
                </p>
              )}

              {reviewedNone ? (
                <p className={styles.expenseReviewedNone}>
                  تمت المراجعة — لا يوجد مصروف من هذا النوع
                </p>
              ) : null}

              <div className={styles.expenseCategoryActions}>
                {canManage && creationRequestIds ? (
                  <ExpenseDrawerLauncher
                    businessId={businessId}
                    returnOrigin={null}
                    categoryOptions={EXPENSE_SETUP_CATEGORY_OPTIONS}
                    behaviorOptions={EXPENSE_COST_BEHAVIOR_OPTIONS}
                    mode="create"
                    creationRequestId={creationRequestIds[category.value]}
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
        <form action={confirmExpenseSetupReview} className={styles.expenseReviewForm}>
          <input type="hidden" name="business_id" value={businessId} />
          {EXPENSE_SETUP_CATEGORY_OPTIONS.filter(
            (category) =>
              noneSelected[category.value] &&
              activeExpenseCategoryCounts[category.value] === 0,
          ).map((category) => (
            <input
              type="hidden"
              name="no_expense_category"
              value={category.value}
              key={category.value}
            />
          ))}
          <p className={styles.expenseSetupPendingNote}>
            اختيار «ليس لدي مصروف من هذا النوع» يظل غير محفوظ حتى تضغط تأكيد مراجعة المصروفات.
          </p>
          <button className={styles.expenseReviewButton} type="submit">
            تأكيد مراجعة المصروفات
          </button>
        </form>
      ) : null}
    </>
  );
}
