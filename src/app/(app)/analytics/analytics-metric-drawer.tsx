"use client";

import { useId, useRef } from "react";
import { MetricAuditContent } from "@/components/metric-audit";
import type { MetricAudit } from "@/lib/business/metric-audit";
import drawerStyles from "@/components/dashboard-metric-drawer.module.css";
import styles from "./analytics-metric-drawer.module.css";

type AnalyticsMetricDrawerProps = {
  currentAudit: MetricAudit;
  previousAudit: MetricAudit;
  currency: string;
  currentMonthLabel: string;
  previousMonthLabel: string;
};

/** Opens one Analytics comparison metric in-context and shows the exact audit trail for both months. */
export function AnalyticsMetricDrawer({
  currentAudit,
  previousAudit,
  currency,
  currentMonthLabel,
  previousMonthLabel,
}: AnalyticsMetricDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId().replaceAll(":", "");
  const dialogId = `analytics-metric-drawer-${generatedId}`;
  const titleId = `${dialogId}-title`;

  /** Opens the metric drawer and moves focus to its explicit close control. */
  function openDrawer() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    queueMicrotask(() => closeRef.current?.focus());
  }

  /** Restores focus to the exact comparison-card launcher after closing the drawer. */
  function handleClose() {
    queueMicrotask(() => openerRef.current?.focus());
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className={drawerStyles.trigger}
        aria-haspopup="dialog"
        aria-controls={dialogId}
        aria-label={`تفاصيل المؤشر — ${currentAudit.title}`}
        onClick={openDrawer}
      >
        تفاصيل الحساب
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        className={drawerStyles.drawer}
        aria-labelledby={titleId}
        onClose={handleClose}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
      >
        <div className={drawerStyles.drawerShell}>
          <header className={drawerStyles.drawerHeader}>
            <div>
              <span className={drawerStyles.kicker}>تفاصيل مؤشر التحليلات</span>
              <h2 id={titleId}>{currentAudit.title}</h2>
              <p>يعرض ميزان نفس مدخلات ونتائج محرك الحساب لكل شهر، بدون إعادة حساب مستقلة داخل التحليلات.</p>
            </div>
            <form method="dialog">
              <button
                ref={closeRef}
                type="submit"
                className={drawerStyles.closeButton}
                aria-label={`إغلاق تفاصيل المؤشر — ${currentAudit.title}`}
              >
                ×
              </button>
            </form>
          </header>

          <div className={drawerStyles.drawerBody}>
            <section className={styles.periodAudit} aria-label={`تفاصيل ${currentMonthLabel}`}>
              <h3>{currentMonthLabel}</h3>
              <MetricAuditContent audit={currentAudit} currency={currency} />
            </section>
            <section className={styles.periodAudit} aria-label={`تفاصيل ${previousMonthLabel}`}>
              <h3>{previousMonthLabel}</h3>
              <MetricAuditContent audit={previousAudit} currency={currency} />
            </section>
          </div>

          <footer className={drawerStyles.drawerFooter}>
            <span className={styles.footerNote}>المقارنة تستخدم القيم الأصلية الدقيقة قبل تقريب العرض.</span>
            <form method="dialog">
              <button type="submit" className={drawerStyles.secondaryButton}>
                إغلاق
              </button>
            </form>
          </footer>
        </div>
      </dialog>
    </>
  );
}
