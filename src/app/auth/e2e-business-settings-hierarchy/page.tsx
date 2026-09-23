import { notFound } from "next/navigation";
import { BusinessSettingsView } from "@/app/(app)/businesses/[businessId]/settings/business-settings-view";
import { SettingsBusinessSelector } from "@/app/(app)/settings/settings-business-selector";
import { AppShell } from "@/components/app-shell";

const BUSINESS_ID = "123e4567-e89b-42d3-a456-426614174000";
const SECOND_BUSINESS_ID = "123e4567-e89b-42d3-a456-426614174001";

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
  };

  return (
    <AppShell role="admin" email="admin.fixture@example.test">
      {query.view === "business" || query.view === "readonly" ? (
        <BusinessSettingsView business={business} canDelete={query.view !== "readonly"} />
      ) : (
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
      )}
    </AppShell>
  );
}
