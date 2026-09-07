import Link from "next/link";
import type { ReactNode } from "react";
import { CustomerAnalysisTabs } from "./customer-analysis-tabs";
import styles from "./customer-groups.module.css";

type CustomerOverviewShellProps = {
  businessId: string;
  businessName: string;
  baseCurrency: string;
  timezone: string;
  historyOverview: ReactNode;
  observedLtv: ReactNode;
  revenueStreams: ReactNode;
  contribution: ReactNode;
  customers: ReactNode;
};

/** Presents customer economics with a compact summary first and deeper analysis on demand. */
export function CustomerOverviewShell({
  businessId,
  businessName,
  baseCurrency,
  timezone,
  historyOverview,
  observedLtv,
  revenueStreams,
  contribution,
  customers,
}: CustomerOverviewShellProps) {
  return (
    <div className={styles.customerWorkspace}>
      <section className={styles.heroShell} aria-labelledby="customer-overview-title">
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>اقتصاديات العميل · {businessName}</span>
          <h1 id="customer-overview-title">العملاء و LTV</h1>
          <p>
            اعرف كم دفع عملاؤك فعلًا، كم منهم اشترى مرة أخرى، وكيف تتطور قيمة العميل المحققة مع الوقت.
          </p>
          <div className={styles.heroMeta}>
            <span>{businessName}</span>
            <span dir="ltr">{baseCurrency}</span>
            <span dir="ltr">{timezone}</span>
          </div>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.primaryAction} href={`/businesses/${businessId}/customers/import`}>
            استيراد معاملات
          </Link>
          <a
            className={styles.secondaryAction}
            href="/mizan-transactions-template.csv"
            download="mizan-transactions-template.csv"
          >
            تنزيل نموذج CSV
          </a>
          <Link className={styles.secondaryAction} href="/customers">
            كل البزنسات
          </Link>
        </div>
      </section>

      {historyOverview}

      <details className={styles.setupDisclosure}>
        <summary>
          <span className={styles.setupSummaryText}>
            <strong className={styles.setupSummaryTitle}>إعدادات التحليل المتقدمة</strong>
            <small className={styles.setupSummaryDescription}>
              ربط مصادر الإيراد وإضافة التكاليف المرتبطة بالعميل عند الحاجة.
            </small>
          </span>
          <span className={styles.disclosureAction}>إعدادات التحليل</span>
        </summary>
        <div className={styles.workflowGrid}>
          <article className={styles.workflowCard}>
            <div className={styles.workflowCardTop}>
              <span className={styles.stepBadge}>1</span>
              <span className={styles.workflowTag}>المعاملات</span>
            </div>
            <h3>استيراد التحصيلات والاسترجاعات</h3>
            <p>سجل بوابة الدفع هو المصدر الأساسي لتاريخ اكتساب العميل وصافي التحصيل.</p>
            <Link className={styles.workflowLink} href={`/businesses/${businessId}/customers/import`}>
              فتح الاستيراد
            </Link>
          </article>

          <article className={styles.workflowCard}>
            <div className={styles.workflowCardTop}>
              <span className={styles.stepBadge}>2</span>
              <span className={styles.workflowTag}>مصدر القيمة</span>
            </div>
            <h3>ربط مصادر الإيراد</h3>
            <p>اربط Front-End وBackend والمصادر الأخرى يدويًا؛ ميزان لا يخمّن Attribution.</p>
            <Link
              className={styles.workflowLink}
              href={`/businesses/${businessId}/customers/revenue-stream-attribution`}
            >
              ربط مصادر الإيراد
            </Link>
          </article>

          <article className={styles.workflowCard}>
            <div className={styles.workflowCardTop}>
              <span className={styles.stepBadge}>3</span>
              <span className={styles.workflowTag}>ربحية العميل</span>
            </div>
            <h3>إضافة التكاليف المرتبطة</h3>
            <p>أكمل تكاليف الاكتساب والتكاليف المتغيرة لحساب ربح المساهمة مدى الحياة.</p>
            <Link
              className={styles.workflowLink}
              href={`/businesses/${businessId}/customers/lifetime-contribution`}
            >
              إدخال التكاليف
            </Link>
          </article>
        </div>
      </details>

      <CustomerAnalysisTabs
        panels={[
          {
            id: "observed-ltv",
            eyebrow: "Observed LTV",
            label: "قيمة العميل مع الوقت",
            content: observedLtv,
          },
          {
            id: "revenue-streams",
            eyebrow: "من أين جاء التحصيل؟",
            label: "مصادر الإيراد",
            content: revenueStreams,
          },
          {
            id: "contribution",
            eyebrow: "بعد التكاليف المتغيرة",
            label: "ربح المساهمة",
            content: contribution,
          },
          {
            id: "customers",
            eyebrow: "المعاملات حسب العميل",
            label: "سجل العملاء",
            content: customers,
          },
        ]}
      />
    </div>
  );
}
