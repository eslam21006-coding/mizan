import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
  businesses: [
    {
      id: "business-one",
      name: "أكاديمية ألف",
      baseCurrency: "EGP",
      timezone: "Africa/Cairo",
    },
    {
      id: "business-two",
      name: "أكاديمية باء",
      baseCurrency: "SAR",
      timezone: "Asia/Riyadh",
    },
  ],
};

type AppShellE2eFixturePageProps = {
  searchParams: Promise<{ businessesError?: string }>;
};

/** Renders deterministic shell states for browser verification only. */
export default async function AppShellE2eFixturePage({
  searchParams,
}: AppShellE2eFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;

  return (
    <AppShell
      {...fixtureShellProps}
      businessesLoadFailed={query.businessesError === "1"}
    >
      <section className="page-stack" aria-label="محتوى اختبار واجهة ميزان">
        <div>
          <span className="eyebrow">اختبار الواجهة</span>
          <h1>الرئيسية</h1>
          <p className="muted-copy">
            صفحة اختبار معزولة للتحقق من الغلاف العربي واتجاه RTL واستجابة التنقل للموبايل.
          </p>
        </div>
        <div className="panel">
          <h2>محتوى تجريبي</h2>
          <p>يظل هذا المسار متاحًا فقط عندما يكون وضع اختبار الواجهة مفعّلًا صراحة.</p>
        </div>
      </section>
    </AppShell>
  );
}
