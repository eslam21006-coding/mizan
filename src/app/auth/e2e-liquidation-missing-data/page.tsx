import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LiquidationMissingDataActions } from "@/app/(app)/businesses/[businessId]/liquidation/liquidation-missing-data-actions";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type LiquidationMissingDataFixturePageProps = {
  searchParams: Promise<{ mode?: string }>;
};

/** CI-only fixture for N46 deterministic Liquidation missing-data actions. */
export default async function LiquidationMissingDataFixturePage({
  searchParams,
}: LiquidationMissingDataFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const complete = query.mode === "complete";

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار معالجة بيانات التسييل">
        <LiquidationMissingDataActions
          businessId={businessId}
          monthKey="2026-09"
          revenueIncomplete={!complete}
          adSpendMissing={!complete}
          allocationIncomplete={!complete}
        />
        <section id="front-end-allocations" aria-label="توزيع Front-End">
          <h2>توزيع التكاليف المتغيرة على الـ Front-End</h2>
        </section>
      </section>
    </AppShell>
  );
}
