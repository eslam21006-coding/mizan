import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BusinessOverviewPanel } from "@/app/(app)/businesses/[businessId]/business-overview-panel";
import { BusinessWorkspaceShell } from "@/app/(app)/businesses/[businessId]/business-workspace-shell";
import { resolveBusinessOverviewHealth } from "@/lib/business-overview";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type FixtureCase = "configured-legacy" | "zero-expense-history" | "partial-readonly";

type FixtureScenario = {
  revenueSourceCount: number;
  activeExpenseItemCount: number;
  configuredExpenseItemCount: number;
  expenseSetupReviewedAt: string | null;
  latestSavedMonthKey: string | null;
  canManage: boolean;
};

const fixtureScenarios: Record<FixtureCase, FixtureScenario> = {
  "configured-legacy": {
    revenueSourceCount: 2,
    activeExpenseItemCount: 0,
    configuredExpenseItemCount: 5,
    expenseSetupReviewedAt: null,
    latestSavedMonthKey: "2026-08",
    canManage: true,
  },
  "zero-expense-history": {
    revenueSourceCount: 1,
    activeExpenseItemCount: 0,
    configuredExpenseItemCount: 0,
    expenseSetupReviewedAt: null,
    latestSavedMonthKey: "2026-08",
    canManage: true,
  },
  "partial-readonly": {
    revenueSourceCount: 1,
    activeExpenseItemCount: 0,
    configuredExpenseItemCount: 0,
    expenseSetupReviewedAt: null,
    latestSavedMonthKey: null,
    canManage: false,
  },
};

type BusinessOverviewFixturePageProps = {
  searchParams: Promise<{ case?: string }>;
};

/** CI-only fixture for B03 Business Overview compatibility and setup-health behavior. */
export default async function BusinessOverviewFixturePage({
  searchParams,
}: BusinessOverviewFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const requestedCase = (await searchParams).case;
  const fixtureCase: FixtureCase =
    requestedCase === "zero-expense-history" || requestedCase === "partial-readonly"
      ? requestedCase
      : "configured-legacy";
  const scenario = fixtureScenarios[fixtureCase];

  const health = resolveBusinessOverviewHealth({
    businessId,
    currentMonthKey: "2026-09",
    revenueSourceCount: scenario.revenueSourceCount,
    expenseItemCount: scenario.activeExpenseItemCount,
    configuredExpenseItemCount: scenario.configuredExpenseItemCount,
    expenseSetupReviewedAt: scenario.expenseSetupReviewedAt,
    currentMonthSaved: false,
    latestSavedMonthKey: scenario.latestSavedMonthKey,
    canManage: scenario.canManage,
    dataLoadError: false,
  });

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <BusinessWorkspaceShell
          businessId={businessId}
          businessName="أكاديمية ميزان"
          baseCurrency="USD"
          timezone="Africa/Cairo"
          activeTab="overview"
        />
        <BusinessOverviewPanel
          baseCurrency="USD"
          timezone="Africa/Cairo"
          revenueSourceCount={scenario.revenueSourceCount}
          expenseItemCount={scenario.activeExpenseItemCount}
          health={health}
        />
      </div>
    </AppShell>
  );
}
