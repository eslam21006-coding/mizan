import { notFound } from "next/navigation";
import { LifetimeContributionTable } from "@/app/(app)/businesses/[businessId]/customers/lifetime-contribution-table";
import { LifetimeRevenueStreamTable } from "@/app/(app)/businesses/[businessId]/customers/lifetime-revenue-stream-table";
import { parseReturnOrigin } from "@/lib/return-origin";

const FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-000000000025";

type LifetimeEconomicsE2eFixturePageProps = {
  searchParams: Promise<{ month?: string | string[] }>;
};

/** Renders isolated lifetime economics with an optional validated profitability return month. */
export default async function LifetimeEconomicsE2eFixturePage({
  searchParams,
}: LifetimeEconomicsE2eFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const parsedOrigin = parseReturnOrigin({
    origin: "customer-profitability",
    month: query.month,
  });
  const returnMonth =
    parsedOrigin?.origin === "customer-profitability" ? parsedOrigin.month : undefined;

  return (
    <main className="page-stack">
      <h1>اختبار اقتصاديات العملاء</h1>
      <LifetimeRevenueStreamTable businessId={FIXTURE_BUSINESS_ID} baseCurrency="EGP" />
      <LifetimeContributionTable businessId={FIXTURE_BUSINESS_ID} baseCurrency="EGP" returnMonth={returnMonth} />
    </main>
  );
}
