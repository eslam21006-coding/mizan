import { notFound } from "next/navigation";
import { BusinessSettingsPageContent } from "@/app/(app)/businesses/[businessId]/settings/business-settings-view";
import { SettingsBusinessSelector } from "@/app/(app)/settings/settings-business-selector";
import { AppShell } from "@/components/app-shell";

const BUSINESS_ID = "123e4567-e89b-42d3-a456-426614174000";
const SECOND_BUSINESS_ID = "123e4567-e89b-42d3-a456-426614174001";
const OWNER_USER_ID = "123e4567-e89b-42d3-a456-426614174100";
const VIEWER_USER_ID = "123e4567-e89b-42d3-a456-426614174101";
const ADMIN_USER_ID = "123e4567-e89b-42d3-a456-426614174102";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type BusinessSettingsHierarchyFixtureProps = {
  searchParams: Promise<{ view?: string }>;
};

/** CI-only fixture for the N59 Settings selector and selected-business hierarchy. */
export default async function BusinessSettingsHierarchyFixture({
  searchParams,
}: BusinessSettingsHierarchyFixtureProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();

  const query = await searchParams;
  const business = {
    id: BUSINESS_ID,
    name: "أكاديمية ميزان",
    baseCurrency: "USD",
    timezone: "Africa/Cairo",
    ownerUserId: OWNER_USER_ID,
  };

  if (query.view === "business" || query.view === "readonly") {
    const viewer =
      query.view === "readonly"
        ? { role: "mentee" as const, userId: VIEWER_USER_ID }
        : { role: "admin" as const, userId: ADMIN_USER_ID };

    return (
      <AppShell {...fixtureShellProps}>
        <BusinessSettingsPageContent business={business} viewer={viewer} />
      </AppShell>
    );
  }

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <h1>اختبار اختيار إعدادات البزنس</h1>
        <SettingsBusinessSelector
          businesses={[
            business,
            {
              id: SECOND_BUSINESS_ID,
              name: "بزنس التدريب",
              baseCurrency: "EGP",
              timezone: "Africa/Cairo",
            },
          ]}
        />
      </div>
    </AppShell>
  );
}
