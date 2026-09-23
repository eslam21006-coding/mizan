"use client";

import { useId, useRef } from "react";
import { StableSubmitButton } from "@/components/stable-submit-button";
import { updateFunnel } from "./actions";
import styles from "./funnel-create-drawer.module.css";

export type FunnelEditDrawerItem = {
  id: string;
  name: string;
  funnel_type: string;
  is_active: boolean;
};

type FunnelEditDrawerLauncherProps = {
  businessId: string;
  typeOptions: ReadonlyArray<{ value: string; label: string }>;
  funnel: FunnelEditDrawerItem;
};

/** Opens the Funnel edit workflow in-context without leaving the Structure page. */
export function FunnelEditDrawerLauncher({
  businessId,
  typeOptions,
  funnel,
}: FunnelEditDrawerLauncherProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const generatedId = useId().replaceAll(":", "");
  const dialogId = `funnel-edit-drawer-${generatedId}`;
  const titleId = `${dialogId}-title`;

  /** Opens the edit drawer and moves focus to its explicit close control. */
  function openDrawer() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    queueMicrotask(() => closeRef.current?.focus());
  }

  /** Discards unsaved edits and restores keyboard focus to the edit launcher. */
  function handleClose() {
    formRef.current?.reset();
    queueMicrotask(() => openerRef.current?.focus());
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className={styles.secondaryTrigger}
        aria-haspopup="dialog"
        aria-controls={dialogId}
        aria-label={`تعديل الفانل ${funnel.name}`}
        onClick={openDrawer}
      >
        تعديل
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
              <span className={styles.kicker}>تعديل فانل</span>
              <h2 id={titleId}>{`تعديل ${funnel.name}`}</h2>
              <p>
                عدّل تعريف الفانل وحالتها فقط. الأداء والأرقام الشهرية تظل في تبويب الأداء الشهري.
              </p>
            </div>
            <form method="dialog">
              <button
                ref={closeRef}
                type="submit"
                className={styles.closeButton}
                aria-label={`إغلاق تعديل الفانل ${funnel.name}`}
              >
                ×
              </button>
            </form>
          </header>

          <div className={styles.drawerBody}>
            <form ref={formRef} action={updateFunnel} className={styles.form}>
              <input type="hidden" name="business_id" value={businessId} />
              <input type="hidden" name="funnel_id" value={funnel.id} />

              <label className={styles.field}>
                <span>اسم الفانل</span>
                <input
                  type="text"
                  name="name"
                  maxLength={120}
                  required
                  defaultValue={funnel.name}
                  autoComplete="off"
                />
              </label>

              <label className={styles.field}>
                <span>نوع الفانل</span>
                <select name="funnel_type" defaultValue={funnel.funnel_type}>
                  {typeOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.activeToggle}>
                <input type="checkbox" name="is_active" defaultChecked={funnel.is_active} />
                <span>الفانل نشطة وتظهر في الإدخالات الجديدة</span>
              </label>

              <div className={styles.footer}>
                <StableSubmitButton className={styles.submitButton} pendingLabel="جارٍ حفظ التعديلات…">
                  حفظ التعديلات
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
