import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  parseCustomerAnalysisView,
  type CustomerSearchParams,
} from "@/lib/customer-analysis-view";
import { CustomerOverviewShell } from "@/app/(app)/businesses/[businessId]/customers/customer-overview-shell";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

const fixtureBusinessId = "business fixture/01";
const fixturePath = "/auth/e2e-customer-tabs";

type CustomerTabsFixturePageProps = {
  searchParams: Promise<CustomerSearchParams>;
};

function FixturePanel({ testId, title }: { testId: string; title: string }) {
  return (
    <section className="panel" data-testid={testId} aria-label={title}>
      <h2>{title}</h2>
      <p className="muted-copy">محتوى اختبار معزول للتحقق من حالة التنقل المحلية بدون بيانات مالية فعلية.</p>
    </section>
  );
}

/** Renders the CI-only Customer tab fixture without database or financial dependencies. */
export default async function CustomerTabsFixturePage({ searchParams }: CustomerTabsFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const customerSearchParams = await searchParams;
  const activeView = parseCustomerAnalysisView(customerSearchParams.view);

  return (
    <AppShell {...fixtureShellProps}>
      <CustomerOverviewShell
        businessId={fixtureBusinessId}
        businessName="أكاديمية ميزان"
        baseCurrency="EGP"
        timezone="Africa/Cairo"
        activeView={activeView}
        searchParams={customerSearchParams}
        reviewIssueCount={0}
        tabBasePath={fixturePath}
        historyOverview={<FixturePanel testId="fixture-overview" title="ملخص اقتصاديات العملاء" />}
        observedLtv={<FixturePanel testId="fixture-value" title="قيمة العميل" />}
        contribution={<FixturePanel testId="fixture-profitability" title="ربحية العميل" />}
        revenueStreams={<FixturePanel testId="fixture-revenue-streams" title="مصادر الإيراد" />}
        customers={<FixturePanel testId="fixture-customers" title="سجل العملاء" />}
      />
    </AppShell>
  );
}
