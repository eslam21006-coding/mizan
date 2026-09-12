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
          <h1 id="customer-overview-title">العملاء وقيمة وربحية العميل</h1>
          <p>
            اعرف كم دفع عملاؤك فعلًا، والربح المحقق منهم بعد التكاليف المرتبطة بالعميل. ميزان يجمع المعاملات ويوزع التكاليف المؤهلة تلقائيًا؛ لا تحتاج إلى توزيع التكاليف يدويًا لكل شهر أول شراء.
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
            <strong className={styles.setupSummaryTitle}>مصادر بيانات اقتصاديات العميل</strong>
            <small className={styles.setupSummaryDescription}>
              المعاملات والمصروفات الشهرية هما المدخلان الأساسيان. ربط مصدر الإيراد اختياري للتحليل التفصيلي.
            </small>
          </span>
          <span className={styles.disclosureAction}>عرض المصادر</span>
        </summary>
        <div className={styles.workflowGrid}>
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
      </details>

      <CustomerAnalysisTabs
        panels={[
          {
            id: "observed-ltv",
            eyebrow: "منذ أول شراء",
            label: "متوسط ما دفعه العميل",
            content: observedLtv,
          },
          {
            id: "contribution",
            eyebrow: "محسوبة تلقائيًا من المصروفات",
            label: "ربحية العميل",
            content: contribution,
          },
          {
            id: "revenue-streams",
            eyebrow: "من أين جاء التحصيل؟",
            label: "مصادر الإيراد",
            content: revenueStreams,
          },
          {
            id: "customers",
            eyebrow: "بحث، فلترة وترتيب",
            label: "سجل العملاء",
            content: customers,
          },
        ]}
      />
    </div>
  );
}
