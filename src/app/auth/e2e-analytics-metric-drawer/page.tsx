import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MonthComparison } from "@/app/(app)/month-comparison";
import {
  calculateCoreFinancials,
  type CoreCalculationInput,
} from "@/lib/business/calculations";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

const previousInput: CoreCalculationInput = {
  revenueStreams: [],
  expenses: [],
  unallocatedGrossCashCollected: "1000",
  unallocatedRefunds: "100",
  newCustomers: 5,
  totalPayingCustomers: 8,
  canonicalAdSpend: "200",
  attributedRevenue: null,
};

const currentInput: CoreCalculationInput = {
  revenueStreams: [],
  expenses: [],
  unallocatedGrossCashCollected: "1200",
  unallocatedRefunds: "100",
  newCustomers: 6,
  totalPayingCustomers: 9,
  canonicalAdSpend: "240",
  attributedRevenue: null,
};

/** CI-only fixture for N52 Analytics metric audit drawers using real core-calculation outputs. */
export default function AnalyticsMetricDrawerFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <h1>التحليلات المالية</h1>
        <MonthComparison
          current={calculateCoreFinancials(currentInput)}
          previous={calculateCoreFinancials(previousInput)}
          currentInput={currentInput}
          previousInput={previousInput}
          currency="EGP"
          currentMonthLabel="أغسطس ٢٠٢٦"
          previousMonthLabel="يوليو ٢٠٢٦"
        />
      </div>
    </AppShell>
  );
}
