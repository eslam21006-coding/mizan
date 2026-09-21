import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BusinessWorkspaceShell } from "@/app/(app)/businesses/[businessId]/business-workspace-shell";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

/** CI-only fixture for N36 business workspace navigation. */
export default function BusinessWorkspaceFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار مساحة عمل البزنس">
        <BusinessWorkspaceShell
          businessId="123e4567-e89b-42d3-a456-426614174000"
          businessName="أكاديمية ميزان"
          baseCurrency="USD"
          timezone="Africa/Cairo"
          activeTab="expenses"
        />
      </section>
    </AppShell>
  );
}
