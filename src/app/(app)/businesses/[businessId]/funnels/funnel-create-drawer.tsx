"use client";

import { useId, useRef } from "react";
import { StableSubmitButton } from "@/components/stable-submit-button";
import { createFunnel } from "./actions";
import styles from "./funnel-create-drawer.module.css";

type FunnelCreateDrawerLauncherProps = {
  businessId: string;
  typeOptions: ReadonlyArray<{ value: string; label: string }>;
  creationRequestId: string;
};

/** Opens the Funnel create workflow in-context without changing the current Structure page. */
export function FunnelCreateDrawerLauncher({
  businessId,
  typeOptions,
  creationRequestId,
}: FunnelCreateDrawerLauncherProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const generatedId = useId().replaceAll(":", "");
  const dialogId = `funnel-create-drawer-${generatedId}`;
  const titleId = `${dialogId}-title`;

  /** Opens the modal drawer and moves focus to its explicit close control. */
  function openDrawer() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    queueMicrotask(() => closeRef.current?.focus());
  }

  /** Resets unsaved create input and restores keyboard focus to the launcher. */
  function handleClose() {
    formRef.current?.reset();
    queueMicrotask(() => openerRef.current?.focus());
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className={styles.primaryTrigger}
        aria-haspopup="dialog"
        aria-controls={dialogId}
        onClick={openDrawer}
      >
        إضافة فانل
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
              <span className={styles.kicker}>فانل جديدة</span>
              <h2 id={titleId}>إضافة فانل جديدة</h2>
              <p>
                عرّف اسم الفانل ونوعها فقط. الأداء والأرقام الشهرية تظل في تبويب الأداء الشهري.
              </p>
            </div>
            <form method="dialog">
              <button
                ref={closeRef}
                type="submit"
                className={styles.closeButton}
                aria-label="إغلاق إضافة فانل"
              >
                ×
              </button>
            </form>
          </header>

          <div className={styles.drawerBody}>
            <form ref={formRef} action={createFunnel} className={styles.form}>
              <input type="hidden" name="business_id" value={businessId} />
              <input type="hidden" name="creation_request_id" value={creationRequestId} />

              <label className={styles.field}>
                <span>اسم الفانل</span>
                <input
                  type="text"
                  name="name"
                  maxLength={120}
                  required
                  placeholder="مثال: ويبينار البرنامج الأساسي"
                  autoComplete="off"
                />
              </label>

              <label className={styles.field}>
                <span>نوع الفانل</span>
                <select name="funnel_type" defaultValue="webinar">
                  {typeOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.footer}>
                <StableSubmitButton className={styles.submitButton} pendingLabel="جارٍ إضافة الفانل…">
                  إضافة الفانل
                </StableSubmitButton>
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
