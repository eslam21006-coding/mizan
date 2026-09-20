"use client";

import { useId, useRef } from "react";
import type { SetupReturnOrigin } from "@/lib/setup-return-origin";
import { createRevenueStream, updateRevenueStream } from "./actions";
import styles from "./revenue-stream-drawer.module.css";

export type RevenueStreamDrawerItem = {
  id: string;
  name: string;
  stream_type: string;
  is_active: boolean;
};

type RevenueStreamDrawerLauncherProps = {
  businessId: string;
  returnOrigin: SetupReturnOrigin | null;
  typeOptions: ReadonlyArray<{ value: string; label: string }>;
  mode: "create" | "edit";
  creationRequestId?: string;
  stream?: RevenueStreamDrawerItem;
};

/** Preserves validated Monthly/upstream return metadata through Revenue Source drawer saves. */
function ReturnContextFields({ returnOrigin }: { returnOrigin: SetupReturnOrigin | null }) {
  if (!returnOrigin) return null;

  return (
    <>
      <input type="hidden" name="origin" value={returnOrigin.origin} />
      <input type="hidden" name="month" value={returnOrigin.month} />
      {returnOrigin.upstream ? (
        <input type="hidden" name="upstream_origin" value={returnOrigin.upstream.origin} />
      ) : null}
      {returnOrigin.upstream?.origin === "customer-profitability" &&
      returnOrigin.upstream.month ? (
        <input type="hidden" name="upstream_month" value={returnOrigin.upstream.month} />
      ) : null}
    </>
  );
}

/** Opens one focused create/edit Revenue Source workflow without leaving the current setup page. */
export function RevenueStreamDrawerLauncher({
  businessId,
  returnOrigin,
  typeOptions,
  mode,
  creationRequestId,
  stream,
}: RevenueStreamDrawerLauncherProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const generatedId = useId().replaceAll(":", "");
  const dialogId = `revenue-stream-drawer-${generatedId}`;
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

  function handleClose() {
    formRef.current?.reset();
    restoreFocus();
  }

  const title = isCreate ? "إضافة مصدر إيراد جديد" : `تعديل ${stream?.name ?? "مصدر الإيراد"}`;
  const triggerLabel = isCreate ? "إضافة مصدر إيراد" : `تعديل مصدر الإيراد ${stream?.name ?? ""}`;
  const submitLabel = isCreate ? "إضافة مصدر الإيراد" : "حفظ التعديلات";

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
        {isCreate ? "إضافة مصدر إيراد" : "تعديل"}
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        className={styles.drawer}
        aria-labelledby={titleId}
        onClose={handleClose}
      >
        <div className={styles.drawerShell}>
          <header className={styles.drawerHeader}>
            <div>
              <span className={styles.kicker}>{isCreate ? "مصدر جديد" : "تعديل مصدر"}</span>
              <h2 id={titleId}>{title}</h2>
              <p>
                عرّف مصدر الإيراد وتصنيفه فقط. التحصيل الفعلي يظل في البيانات الشهرية ومعاملات العملاء.
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
              ref={formRef}
              action={isCreate ? createRevenueStream : updateRevenueStream}
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
                <input type="hidden" name="stream_id" value={stream?.id ?? ""} />
              )}
              <ReturnContextFields returnOrigin={returnOrigin} />

              <label className={styles.field}>
                <span>اسم مصدر الإيراد</span>
                <input
                  type="text"
                  name="name"
                  maxLength={120}
                  required
                  defaultValue={stream?.name ?? ""}
                  placeholder="مثال: البرنامج الأساسي"
                  autoComplete="off"
                />
              </label>

              <label className={styles.field}>
                <span>التصنيف</span>
                <select name="stream_type" defaultValue={stream?.stream_type ?? "front_end"}>
                  {typeOptions.map((option) => (
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
                    defaultChecked={stream?.is_active ?? false}
                  />
                  <span>المصدر نشط ويظهر في الإدخالات الجديدة</span>
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
