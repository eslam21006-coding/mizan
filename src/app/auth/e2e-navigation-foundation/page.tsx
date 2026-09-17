import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BusinessContext } from "@/components/business-context";
import { BackLink, Breadcrumb } from "@/components/navigation-hierarchy";
import type { BreadcrumbItem } from "@/lib/navigation-hierarchy";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

const fixtureBusinessId = "business fixture/01";

const breadcrumbItems = [
  { label: "البزنسات", destination: { route: "businesses" } },
  {
    label: "أكاديمية ميزان",
    destination: { route: "business-overview", businessId: fixtureBusinessId },
  },
  { label: "اقتصاديات العملاء", current: true },
] satisfies readonly BreadcrumbItem[];

/** Renders the CI-only page used to verify N01/N02 without migrating production modules. */
export default function NavigationFoundationE2eFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار أساس التنقل الداخلي">
        <BusinessContext businessName="أكاديمية ميزان" baseCurrency="SAR" timezone="Asia/Riyadh" />
        <Breadcrumb items={breadcrumbItems} />
        <BackLink
          label="العودة إلى البزنس"
          destination={{ route: "business-overview", businessId: fixtureBusinessId }}
        />
        <div className="panel">
          <span className="eyebrow">اختبار معزول</span>
          <h1>اقتصاديات العملاء</h1>
          <p className="muted-copy">
            يثبت هذا المسار مكونات سياق البزنس ومسار التنقل والعودة الحتمية بدون ربطها بمنطق مالي أو بيانات فعلية.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
