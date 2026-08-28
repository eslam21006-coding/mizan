import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

export default function AppShellE2eFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
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
