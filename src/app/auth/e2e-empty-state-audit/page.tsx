import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import dashboardStyles from "@/app/(app)/dashboard.module.css";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

/** CI-only fixture for the N62 actionable empty-state contract. */
export default function EmptyStateAuditFixture() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <h1>اختبار الحالات الفارغة</h1>
        <section
          className={dashboardStyles.emptyState}
          aria-label="حالة فارغة قابلة للتنفيذ"
        >
          <span className={dashboardStyles.eyebrow}>لا توجد بيانات بعد</span>
          <h2>هذه الحالة متوقعة قبل أول إدخال</h2>
          <p>
            لا يوجد خطأ في الحساب. لم تُحفظ بيانات فعلية بعد، لذلك لا يعرض ميزان أرقامًا مفترضة.
          </p>
          <Link className={dashboardStyles.primaryAction} href="/businesses/new">
            تنفيذ الخطوة التالية
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
