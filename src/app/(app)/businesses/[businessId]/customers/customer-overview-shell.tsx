import Link from "next/link";
import type { ReactNode } from "react";
import type { CustomerAnalysisView, CustomerSearchParams } from "@/lib/customer-analysis-view";
import { CustomerAnalysisTabs } from "./customer-analysis-tabs";
import { CustomerDataSourcesDrawer } from "./customer-data-sources-drawer";
import { CustomerReviewNotice } from "./customer-review-notice";
import styles from "./customer-groups.module.css";

type CustomerOverviewShellProps = {
  businessId: string;
  businessName: string;
  baseCurrency: string;
  timezone: string;
  activeView: CustomerAnalysisView;
  searchParams: CustomerSearchParams;
  reviewIssueCount: number | null;
  reviewLoadError?: boolean;
  historyOverview: ReactNode;
  observedLtv: ReactNode;
  revenueStreams: ReactNode;
  contribution: ReactNode;
  customers: ReactNode;
  tabBasePath?: string;
};

/** Presents customer economics with URL-addressable local views and a dedicated Overview tab. */
export function CustomerOverviewShell({
  businessId,
  businessName,
  baseCurrency,
  timezone,
  activeView,
  searchParams,
  reviewIssueCount,
  reviewLoadError = false,
  historyOverview,
  observedLtv,
  revenueStreams,
  contribution,
  customers,
  tabBasePath,
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
        </div>
      </section>

      <CustomerDataSourcesDrawer businessId={businessId} />
      <CustomerReviewNotice
        businessId={businessId}
        issueCount={reviewIssueCount}
        loadError={reviewLoadError}
      />

      <CustomerAnalysisTabs
        businessId={businessId}
        activeView={activeView}
        searchParams={searchParams}
        tabBasePath={tabBasePath}
        panels={[
          {
            id: "overview",
            eyebrow: "ملخص اقتصاديات العملاء",
            label: "نظرة عامة",
            content: historyOverview,
          },
          {
            id: "value",
            eyebrow: "منذ أول شراء",
            label: "متوسط ما دفعه العميل",
            content: observedLtv,
          },
          {
            id: "profitability",
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
