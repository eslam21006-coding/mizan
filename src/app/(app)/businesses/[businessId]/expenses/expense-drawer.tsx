"use client";

import { useId, useRef } from "react";
import type { SetupReturnOrigin } from "@/lib/setup-return-origin";
import { createExpenseItem, updateExpenseItem } from "./actions";
import styles from "./expense-drawer.module.css";

export type ExpenseDrawerItem = {
  id: string;
  name: string;
  category: string;
  cost_behavior: string;
  is_active: boolean;
};

type ExpenseDrawerLauncherProps = {
  businessId: string;
  returnOrigin: SetupReturnOrigin | null;
  categoryOptions: ReadonlyArray<{ value: string; label: string }>;
  behaviorOptions: ReadonlyArray<{ value: string; label: string }>;
  mode: "create" | "edit";
  creationRequestId?: string;
  expense?: ExpenseDrawerItem;
};

/** Preserves the validated N26/N27 setup-return metadata through drawer form submissions. */
function ReturnContextFields({ returnOrigin }: { returnOrigin: SetupReturnOrigin | null }) {
  if (!returnOrigin) return null;

  return (
    <>
      <input type="hidden" name="origin" value={returnOrigin.origin} />
      <input type="hidden" name="month" value={returnOrigin.month} />
      {returnOrigin.upstream ? (
        <input type="hidden" name="upstream_origin" value={returnOrigin.upstream.origin} />
      ) : null}
      {(returnOrigin.upstream?.origin === "customer-profitability" ||
        returnOrigin.upstream?.origin === "insights") &&
      returnOrigin.upstream.month ? (
        <input type="hidden" name="upstream_month" value={returnOrigin.upstream.month} />
      ) : null}
      {returnOrigin.upstream?.origin === "insights" ? (
        <>
          <input
            type="hidden"
            name="upstream_insight_rule"
            value={returnOrigin.upstream.ruleId}
          />
          {returnOrigin.upstream.subjectId ? (
            <input
              type="hidden"
              name="upstream_insight_subject"
              value={returnOrigin.upstream.subjectId}
            />
          ) : null}
        </>
      ) : null}
      {returnOrigin.upstream?.origin === "target-planner" ? (
        <>
          <input
            type="hidden"
            name="upstream_planner_step"
            value={returnOrigin.upstream.step}
          />
          <input
            type="hidden"
            name="upstream_planner_goal"
            value={returnOrigin.upstream.goal}
          />
          {returnOrigin.upstream.value !== undefined ? (
            <input
              type="hidden"
              name="upstream_planner_value"
              value={returnOrigin.upstream.value}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** Opens one focused create/edit expense workflow without leaving the current Expenses page context. */
export function ExpenseDrawerLauncher({
  businessId,
  returnOrigin,
  categoryOptions,
  behaviorOptions,
  mode,
  creationRequestId,
  expense,
}: ExpenseDrawerLauncherProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId().replaceAll(":", "");
  const dialogId = `expense-drawer-${generatedId}`;
  const titleId = `${dialogId}-title`;
  const isCreate = mode === "create";

  function openDrawer() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    queueMicrotask(() => closeRef.current?.focus());
  }

  function restoreFocus() {
    queueMicrotask(() => openerRef.current?.focus());
  }

  const title = isCreate ? "إضافة مصروف جديد" : `تعديل ${expense?.name ?? "المصروف"}`;
  const triggerLabel = isCreate ? "إضافة مصروف" : `تعديل المصروف ${expense?.name ?? ""}`;
  const submitLabel = isCreate ? "إضافة المصروف" : "حفظ التعديلات";

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className={isCreate ? styles.primaryTrigger : styles.secondaryTrigger}
        aria-haspopup="dialog"
        aria-controls={dialogId}
        onClick={openDrawer}
      >
        {isCreate ? "إضافة مصروف" : "تعديل"}
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        className={styles.drawer}
        aria-labelledby={titleId}
        onClose={restoreFocus}
      >
        <div className={styles.drawerShell}>
          <header className={styles.drawerHeader}>
            <div>
              <span className={styles.kicker}>{isCreate ? "بند جديد" : "تعديل بند"}</span>
              <h2 id={titleId}>{title}</h2>
              <p>
                حدّد تعريف المصروف فقط. القيمة الفعلية أو النسبة تُدخل لاحقًا داخل البيانات الشهرية.
              </p>
            </div>
            <form method="dialog">
              <button
                ref={closeRef}
                type="submit"
                className={styles.closeButton}
                aria-label={`إغلاق ${triggerLabel}`}
              >
                ×
              </button>
            </form>
          </header>

          <div className={styles.drawerBody}>
            <form
              action={isCreate ? createExpenseItem : updateExpenseItem}
              className={styles.form}
            >
              <input type="hidden" name="business_id" value={businessId} />
              {isCreate ? (
                <input
                  type="hidden"
                  name="creation_request_id"
                  value={creationRequestId ?? ""}
                />
              ) : (
                <input type="hidden" name="expense_id" value={expense?.id ?? ""} />
              )}
              <ReturnContextFields returnOrigin={returnOrigin} />

              <label className={styles.field}>
                <span>اسم المصروف</span>
                <input
                  type="text"
                  name="name"
                  maxLength={120}
                  required
                  defaultValue={expense?.name ?? ""}
                  placeholder="مثال: إعلانات Meta"
                  autoComplete="off"
                />
              </label>

              <label className={styles.field}>
                <span>التصنيف</span>
                <select name="category" defaultValue={expense?.category ?? "acquisition"}>
                  {categoryOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>طريقة التكلفة</span>
                <select
                  name="cost_behavior"
                  defaultValue={expense?.cost_behavior ?? "fixed_monthly"}
                >
                  {behaviorOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {!isCreate ? (
                <label className={styles.activeToggle}>
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={expense?.is_active ?? false}
                  />
                  <span>المصروف نشط ويظهر في الإدخالات الجديدة</span>
                </label>
              ) : null}

              <div className={styles.footer}>
                <button type="submit" className={styles.submitButton}>
                  {submitLabel}
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => dialogRef.current?.close()}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
