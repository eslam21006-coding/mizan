import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { MonthlyNavigationShell } from "@/app/(app)/businesses/[businessId]/monthly/monthly-navigation-shell";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.monthly-shell@example.test",
};

const fixtureBusinessId = "business fixture/monthly";

/** Renders the CI-only Monthly shell fixture for N23/N24 hierarchy and responsive verification. */
export default function MonthlyNavigationShellE2eFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار هيكل الإدخال الشهري">
        <MonthlyNavigationShell
          businessId={fixtureBusinessId}
          businessName="أكاديمية ميزان"
          baseCurrency="SAR"
          timezone="Asia/Riyadh"
        />

        <PageHeading
          title="الإدخال الشهري"
          description="اختبار معزول لهيكل التنقل وسياق البزنس في شاشة الإدخال الشهري."
        />

        <ReturnContextBanner
          purpose="بيانات مطلوبة في ربحية العميل"
          origin={{ origin: "customer-profitability", month: "2026-08" }}
          context={{ businessId: fixtureBusinessId }}
          returnLabel="العودة إلى ربحية العميل"
          ariaLabel="العودة إلى سياق ربحية العميل"
        />

        <div className="panel">
          <strong>محتوى الإدخال الشهري</strong>
        </div>
      </section>
    </AppShell>
  );
}
