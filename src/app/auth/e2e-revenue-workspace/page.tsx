import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RevenueStreamsWorkspaceHeader } from "@/app/(app)/businesses/[businessId]/revenue-streams/revenue-streams-workspace-header";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

/** CI-only fixture for N38 Revenue Sources workspace hierarchy and primary action. */
export default function RevenueWorkspaceFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار مصادر الإيراد داخل مساحة البزنس">
        <RevenueStreamsWorkspaceHeader
          businessId={businessId}
          businessName="أكاديمية ميزان"
          baseCurrency="USD"
          timezone="Africa/Cairo"
          canManage
          returnOrigin={null}
          creationRequestId="11111111-1111-4111-8111-111111111111"
        />

        <section className="shell-card" aria-label="المصادر الحالية">
          <strong>البرنامج الأساسي</strong>
          <p>Front-End / أمامي</p>
        </section>
      </section>
    </AppShell>
  );
}
