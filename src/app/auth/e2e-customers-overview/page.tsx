import { notFound } from "next/navigation";
import { CustomerHistoryOverview } from "@/app/(app)/businesses/[businessId]/customers/customer-history-overview";
import { CustomerOverviewShell } from "@/app/(app)/businesses/[businessId]/customers/customer-overview-shell";
import {
  parseCustomerAnalysisView,
  type CustomerSearchParams,
} from "@/lib/customer-analysis-view";

const FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-000000000057";
const FIXTURE_PATH = "/auth/e2e-customers-overview";

type CustomerOverviewE2eFixturePageProps = {
  searchParams: Promise<CustomerSearchParams>;
};

/** Renders deterministic customer-overview content for browser-only RTL and URL-state verification. */
export default async function CustomerOverviewE2eFixturePage({
  searchParams,
}: CustomerOverviewE2eFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const customerSearchParams = await searchParams;
  const activeView = parseCustomerAnalysisView(customerSearchParams.view);

  return (
    <main className="page-stack">
      <CustomerOverviewShell
        businessId={FIXTURE_BUSINESS_ID}
        businessName="بزنس الاختبار"
        baseCurrency="USD"
        timezone="Africa/Cairo"
        activeView={activeView}
        searchParams={customerSearchParams}
        tabBasePath={FIXTURE_PATH}
        historyOverview={
          <CustomerHistoryOverview
            baseCurrency="USD"
            summary={{
              payingCustomerCountText: "1260",
              repeatCustomerCountText: "262",
              netCashCollectedText: "321575.88",
              revenuePerPayingCustomerText: "255.218952380952381",
            }}
          />
        }
        observedLtv={
          <section aria-label="لوحة قيمة العميل المحققة">
            <h2>Observed LTV / قيمة العميل المحققة حتى الآن</h2>
            <p>قيمة محققة من سجل المعاملات.</p>
          </section>
        }
        revenueStreams={
          <section aria-label="لوحة مصادر الإيراد">
            <h2>تحليل مصادر الإيراد مدى الحياة</h2>
            <p>Front-End وBackend حسب الربط الصريح.</p>
          </section>
        }
        contribution={
          <section aria-label="لوحة ربح المساهمة">
            <h2>Lifetime Contribution Profit / ربح المساهمة مدى الحياة</h2>
            <p>بعد التكاليف المرتبطة بالعميل.</p>
          </section>
        }
        customers={
          <section aria-label="لوحة سجل العملاء">
            <h2>العملاء</h2>
            <p>المعاملات محفوظة حسب العميل.</p>
          </section>
        }
      />
    </main>
  );
}
