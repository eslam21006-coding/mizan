import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { calculateCoreFinancials } from "@/lib/business/calculations";
import { PayoffScreen } from "@/app/(app)/businesses/[businessId]/setup/result/payoff-screen";

const businessId = "00000000-0000-4000-8000-000000000146";
const fixtureShellProps = { role: "admin" as const, email: "payoff.fixture@example.test" };

type Props = { searchParams: Promise<{ case?: string }> };

/** CI-only, controlled presentation fixture: never queries or writes business financial data. */
export default async function SetupPayoffFixture({ searchParams }: Props) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();
  const { case: example = "normal" } = await searchParams;
  const customers = example === "zero-customers" ? 0 : 11;
  const gross = example === "zero-cash" ? "0" : example === "loss" ? "2000" : "12000";
  const refunds = example === "zero-cash" || example === "loss" ? "0" : "2000";
  const currency = example === "loss" ? "EGP" : "USD";

  const result = calculateCoreFinancials({
    revenueStreams: [
      { id: "agency", name: "Agency", streamType: "front_end", grossCashCollected: gross, refunds },
    ],
    expenses: [
      { id: "ads", name: "Ads", category: "acquisition", behavior: "fixed_monthly", inputValue: "2500" },
      { id: "fulfillment", name: "Fulfillment", category: "fulfillment", behavior: "fixed_monthly", inputValue: "1000" },
      { id: "overhead", name: "Overhead", category: "overhead", behavior: "fixed_monthly", inputValue: "1500" },
      { id: "fees", name: "Fees", category: "financial", behavior: "fixed_monthly", inputValue: "500" },
    ],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers: customers,
    totalPayingCustomers: customers,
    canonicalAdSpend: null,
  });

  return (
    <AppShell {...fixtureShellProps}>
      <PayoffScreen
        businessId={businessId}
        businessName="أكاديمية ميزان للتجربة"
        monthKey="2026-09"
        currency={currency}
        financials={result}
      />
    </AppShell>
  );
}
