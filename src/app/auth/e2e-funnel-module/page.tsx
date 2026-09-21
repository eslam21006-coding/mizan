import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FunnelHierarchyBack } from "@/app/(app)/businesses/[businessId]/funnel-hierarchy-back";
import { FunnelModuleShell } from "@/app/(app)/businesses/[businessId]/funnel-module-shell";
import type { FunnelModuleTab } from "@/lib/funnel-module";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type FunnelModuleFixturePageProps = {
  searchParams: Promise<{ tab?: string; month?: string }>;
};

/** Restricts the fixture to the three supported Funnel module tab states. */
function parseTab(value: string | undefined): FunnelModuleTab {
  return value === "monthly" || value === "liquidation" ? value : "structure";
}

/** CI-only fixture for N40 persistent Funnel module navigation. */
export default async function FunnelModuleFixturePage({
  searchParams,
}: FunnelModuleFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const activeTab = parseTab(query.tab);
  const monthKey = query.month ?? "2026-09";

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار وحدة الفانلز">
        <FunnelModuleShell
          businessId={businessId}
          activeTab={activeTab}
          monthKey={monthKey}
        />
        <FunnelHierarchyBack
          businessId={businessId}
          monthKey={activeTab === "structure" ? null : monthKey}
        />
        <section className="shell-card">
          <strong>
            {activeTab === "structure"
              ? "هيكل الفانلز"
              : activeTab === "monthly"
                ? "الأداء الشهري"
                : "تسييل الإنفاق"}
          </strong>
        </section>
      </section>
    </AppShell>
  );
}
