import { notFound } from "next/navigation";
import { BusinessWorkspaceShell } from "@/app/(app)/businesses/[businessId]/business-workspace-shell";
import { AdminBusinessViewingBanner } from "@/components/admin-business-viewing-banner";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type BusinessWorkspaceFixturePageProps = {
  searchParams: Promise<{ owner?: string }>;
};

/** CI-only fixture for business workspace navigation and Admin viewing context. */
export default async function BusinessWorkspaceFixturePage({
  searchParams,
}: BusinessWorkspaceFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const adminViewingMenteeUserId =
    query.owner === "self" ? null : "00000000-0000-4000-8000-000000000057";

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار مساحة عمل البزنس">
        {adminViewingMenteeUserId && (
          <AdminBusinessViewingBanner menteeUserId={adminViewingMenteeUserId} />
        )}
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
