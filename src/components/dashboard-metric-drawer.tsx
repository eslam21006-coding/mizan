"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { MetricAuditContent } from "@/components/metric-audit";
import type { MetricAudit } from "@/lib/business/metric-audit";
import styles from "./dashboard-metric-drawer.module.css";

type DashboardMetricDrawerProps = {
  audit: MetricAudit;
  currency: string;
  businessId: string;
  monthKey: string;
  compact?: boolean;
};

/** Opens one Dashboard KPI audit in-context and exposes an explicit deep-analysis navigation action. */
export function DashboardMetricDrawer({
  audit,
  currency,
  businessId,
  monthKey,
  compact = false,
}: DashboardMetricDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId().replaceAll(":", "");
  const dialogId = `dashboard-metric-drawer-${generatedId}`;
  const titleId = `${dialogId}-title`;

  /** Opens the KPI drawer and moves keyboard focus to its explicit close control. */
  function openDrawer() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    queueMicrotask(() => closeRef.current?.focus());
  }

  /** Restores focus to the exact KPI launcher after closing the drawer. */
  function handleClose() {
    queueMicrotask(() => openerRef.current?.focus());
  }

  const analyticsHref = `/analytics?business=${encodeURIComponent(
    businessId,
  )}&month=${encodeURIComponent(monthKey)}`;

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className={compact ? styles.compactTrigger : styles.trigger}
        aria-haspopup="dialog"
        aria-controls={dialogId}
        aria-label={`تفاصيل المؤشر — ${audit.title}`}
        onClick={openDrawer}
      >
        الرقم ده جاي منين؟
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        className={styles.drawer}
        aria-labelledby={titleId}
        onClose={handleClose}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
      >
        <div className={styles.drawerShell}>
          <header className={styles.drawerHeader}>
            <div>
              <span className={styles.kicker}>تفاصيل المؤشر</span>
              <h2 id={titleId}>{audit.title}</h2>
              <p>تفاصيل الحساب والمصدر المستخدمين في نفس رقم الداشبورد، بدون إعادة حساب مستقلة.</p>
            </div>
            <form method="dialog">
              <button
                ref={closeRef}
                type="submit"
                className={styles.closeButton}
                aria-label={`إغلاق تفاصيل المؤشر — ${audit.title}`}
              >
                ×
              </button>
            </form>
          </header>

          <div className={styles.drawerBody}>
            <MetricAuditContent audit={audit} currency={currency} />
          </div>

          <footer className={styles.drawerFooter}>
            <Link className={styles.deepAnalysisLink} href={analyticsHref}>
              تحليل أعمق
            </Link>
            <form method="dialog">
              <button type="submit" className={styles.secondaryButton}>
                إغلاق
              </button>
            </form>
          </footer>
        </div>
      </dialog>
    </>
  );
}
