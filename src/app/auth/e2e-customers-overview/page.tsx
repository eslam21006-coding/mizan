import { notFound } from "next/navigation";
import { CustomerHistoryOverview } from "@/app/(app)/businesses/[businessId]/customers/customer-history-overview";
import { CustomerOverviewShell } from "@/app/(app)/businesses/[businessId]/customers/customer-overview-shell";

const FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-000000000057";

/** Renders deterministic customer-overview content for browser-only RTL and interaction verification. */
export default function CustomerOverviewE2eFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <main className="page-stack">
      <CustomerOverviewShell
        businessId={FIXTURE_BUSINESS_ID}
        businessName="بزنس الاختبار"
        baseCurrency="USD"
        timezone="Africa/Cairo"
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
