import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BusinessOnboardingWizard } from "@/app/(app)/businesses/new/business-onboarding-wizard";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

/** CI-only fixture for the B05 one-screen creation form without performing database writes. */
export default function BusinessOnboardingFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <BusinessOnboardingWizard
          creationRequestId="77777777-7777-4777-8777-777777777777"
          serverError={null}
        />
      </div>
    </AppShell>
  );
}
