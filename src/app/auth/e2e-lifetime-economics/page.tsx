import { notFound } from "next/navigation";
import { LifetimeContributionTable } from "@/app/(app)/businesses/[businessId]/customers/lifetime-contribution-table";
import { LifetimeRevenueStreamTable } from "@/app/(app)/businesses/[businessId]/customers/lifetime-revenue-stream-table";

const FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-000000000025";

export default function LifetimeEconomicsE2eFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <main className="page-stack">
      <h1>اختبار اقتصاديات العملاء</h1>
      <LifetimeRevenueStreamTable businessId={FIXTURE_BUSINESS_ID} baseCurrency="EGP" />
      <LifetimeContributionTable businessId={FIXTURE_BUSINESS_ID} baseCurrency="EGP" />
    </main>
  );
}
