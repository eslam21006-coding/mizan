"use client";

import Link from "next/link";
import { useRef } from "react";
import styles from "./customer-data-sources-drawer.module.css";

type CustomerDataSourcesDrawerProps = {
  businessId: string;
};

const DRAWER_ID = "customer-data-sources-drawer";
const DRAWER_TITLE_ID = "customer-data-sources-title";

/** Keeps Customer data-source guidance in context instead of expanding the page inline. */
export function CustomerDataSourcesDrawer({ businessId }: CustomerDataSourcesDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  /** Opens the Data Sources dialog as a modal drawer with native focus management. */
  function openDrawer() {
    dialogRef.current?.showModal();
  }

  return (
    <>
      <button
        type="button"
        className={styles.dataSourcesCard}
        aria-haspopup="dialog"
        aria-controls={DRAWER_ID}
        onClick={openDrawer}
      >
        <span className={styles.cardCopy}>
          <strong>مصادر بيانات اقتصاديات العميل</strong>
          <small>
            المعاملات والمصروفات الشهرية هما المدخلان الأساسيان. ربط مصدر الإيراد اختياري للتحليل التفصيلي.
          </small>
        </span>
        <span className={styles.cardAction}>
          عرض المصادر
          <span aria-hidden="true" className={styles.chevron}>‹</span>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        id={DRAWER_ID}
        className={styles.drawer}
        aria-labelledby={DRAWER_TITLE_ID}
      >
        <div className={styles.drawerShell}>
          <header className={styles.drawerHeader}>
            <div>
              <span className={styles.kicker}>مصادر البيانات</span>
              <h2 id={DRAWER_TITLE_ID}>مصادر بيانات اقتصاديات العميل</h2>
              <p>
                هذه المصادر تساعد ميزان على حساب اقتصاديات العميل من بيانات حقيقية بدون تخمين Attribution.
              </p>
            </div>
            <form method="dialog">
              <button type="submit" className={styles.closeButton} aria-label="إغلاق مصادر البيانات">
                ×
              </button>
            </form>
          </header>

          <div className={styles.workflowList}>
            <article className={styles.workflowCard}>
              <div className={styles.workflowCardTop}>
                <span className={styles.stepBadge}>1</span>
                <span className={styles.workflowTag}>المعاملات</span>
              </div>
              <h3>استيراد التحصيلات والاسترجاعات</h3>
              <p>سجل بوابة الدفع هو المصدر الأساسي لأول شراء وصافي التحصيل وقيمة العميل المحققة.</p>
              <Link className={styles.workflowLink} href={`/businesses/${businessId}/customers/import`}>
                فتح الاستيراد
              </Link>
            </article>

            <article className={styles.workflowCard}>
              <div className={styles.workflowCardTop}>
                <span className={styles.stepBadge}>2</span>
                <span className={styles.workflowTag}>المصروفات</span>
              </div>
              <h3>سجل المصروفات مرة واحدة</h3>
              <p>ميزان يستخدم تصنيف وسلوك المصروفات الشهرية ليحدد ما يدخل في ربحية العميل وما يبقى في Real Net Profit.</p>
              <Link className={styles.workflowLink} href={`/businesses/${businessId}/expenses`}>
                فتح إعداد المصروفات
              </Link>
            </article>

            <article className={styles.workflowCard}>
              <div className={styles.workflowCardTop}>
                <span className={styles.stepBadge}>3</span>
                <span className={styles.workflowTag}>اختياري</span>
              </div>
              <h3>ربط مصادر الإيراد عند الحاجة</h3>
              <p>اربط Front-End وBackend والمصادر الأخرى فقط إذا كنت تريد تحليل مصدر القيمة. ميزان لا يخمّن Attribution.</p>
              <Link
                className={styles.workflowLink}
                href={`/businesses/${businessId}/customers/revenue-stream-attribution`}
              >
                ربط مصادر الإيراد
              </Link>
            </article>
          </div>
        </div>
      </dialog>
    </>
  );
}
