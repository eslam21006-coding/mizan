import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BusinessOverviewPanel } from "@/app/(app)/businesses/[businessId]/business-overview-panel";
import { BusinessWorkspaceShell } from "@/app/(app)/businesses/[businessId]/business-workspace-shell";
import { resolveBusinessOverviewHealth } from "@/lib/business-overview";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";

/** CI-only fixture for N37 Business Overview setup-health behavior. */
export default function BusinessOverviewFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const health = resolveBusinessOverviewHealth({
    businessId,
    currentMonthKey: "2026-09",
    revenueSourceCount: 2,
    expenseItemCount: 5,
    currentMonthSaved: false,
    latestSavedMonthKey: "2026-08",
    canManage: true,
    dataLoadError: false,
  });

  return (
    <AppShell role="admin" email="admin.fixture@example.test">
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
          revenueSourceCount={2}
          expenseItemCount={5}
          health={health}
        />
      </div>
    </AppShell>
  );
}
