import Link from "next/link";
import type { ReactNode } from "react";
import { CustomerAnalysisTabs } from "./customer-analysis-tabs";
import styles from "./customer-groups.module.css";

type CustomerOverviewShellProps = {
  businessId: string;
  businessName: string;
  baseCurrency: string;
  timezone: string;
  observedLtv: ReactNode;
  revenueStreams: ReactNode;
  contribution: ReactNode;
  customers: ReactNode;
};

/** Presents the customer-economics workflows and analyses without changing their underlying calculations. */
export function CustomerOverviewShell({
  businessId,
  businessName,
  baseCurrency,
  timezone,
  observedLtv,
  revenueStreams,
  contribution,
  customers,
}: CustomerOverviewShellProps) {
  return (
    <div className={styles.customerWorkspace}>
      <section className={styles.heroShell} aria-labelledby="customer-overview-title">
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>اقتصاديات العميل</span>
          <h1 id="customer-overview-title">العملاء و LTV — {businessName}</h1>
          <p>
            ابدأ من التحصيلات الفعلية، ثم راقب قيمة العميل المحققة ومصادر الإيراد وربح المساهمة عبر عمر العميل.
            ميزان لا يحوّل إيراد فترة واحدة إلى LTV.
          </p>
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

      <section className={styles.businessStrip} aria-label="سياق البزنس">
        <div>
          <span>البزنس</span>
          <strong>{businessName}</strong>
        </div>
        <div>
          <span>العملة الأساسية</span>
          <strong dir="ltr">{baseCurrency}</strong>
        </div>
        <div>
          <span>منطقة التقارير</span>
          <strong dir="ltr">{timezone}</strong>
        </div>
      </section>

      <section className={styles.workflowSection} aria-labelledby="customer-workflow-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.kicker}>جهّز التحليل بالترتيب الصحيح</span>
            <h2 id="customer-workflow-title">مسار بيانات العملاء</h2>
            <p>كل خطوة تضيف طبقة تحليل أعمق، بينما تظل المعاملات الفعلية هي المصدر الأساسي.</p>
          </div>
        </div>

        <div className={styles.workflowGrid}>
          <article className={styles.workflowCard}>
            <div className={styles.workflowCardTop}>
              <span className={styles.stepBadge}>1</span>
              <span className={styles.workflowTag}>الأساس</span>
            </div>
            <h3>استورد التحصيلات والاسترجاعات</h3>
            <p>من سجل بوابة الدفع الفعلي. منه يتحدد العميل وتاريخ اكتسابه والكوهورت وصافي التحصيل.</p>
            <Link className={styles.workflowLink} href={`/businesses/${businessId}/customers/import`}>
              فتح استيراد المعاملات
            </Link>
          </article>

          <article className={styles.workflowCard}>
            <div className={styles.workflowCardTop}>
              <span className={styles.stepBadge}>2</span>
              <span className={styles.workflowTag}>تحليل الإيراد</span>
            </div>
            <h3>اربط المعاملات بمصادر الإيراد</h3>
            <p>Front-End أو Backend أو مصادر أخرى. الربط صريح؛ ميزان لا يخمّن Attribution من قيمة المعاملة.</p>
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
            <h3>أكمل التكاليف المرتبطة بالعميل</h3>
            <p>أضف تكاليف الاكتساب والتكاليف المتغيرة المرتبطة بالكوهورت لحساب ربح المساهمة مدى الحياة.</p>
            <Link
              className={styles.workflowLink}
              href={`/businesses/${businessId}/customers/lifetime-contribution`}
            >
              إدخال تكاليف المساهمة
            </Link>
          </article>
        </div>
      </section>

      <CustomerAnalysisTabs
        panels={[
          {
            id: "observed-ltv",
            eyebrow: "القيمة المحققة",
            label: "Observed LTV",
            content: observedLtv,
          },
          {
            id: "revenue-streams",
            eyebrow: "من أين جاءت القيمة؟",
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
            eyebrow: "من دفع ومتى؟",
            label: "سجل العملاء",
            content: customers,
          },
        ]}
      />
    </div>
  );
}
