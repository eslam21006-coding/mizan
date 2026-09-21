import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DashboardMetricDrawer } from "@/components/dashboard-metric-drawer";
import type { MetricAudit } from "@/lib/business/metric-audit";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

const audit: MetricAudit = {
  key: "realNetProfit",
  title: "صافي الربح الحقيقي",
  formula: "صافي الكاش المحصل − إجمالي تكاليف البزنس",
  source: "محرك الحساب المركزي بعد إدخال كل تصنيفات التكلفة الأربعة.",
  lines: [
    {
      id: "profit-net-cash",
      label: "صافي الكاش المحصل",
      lineType: "subtotal",
      value: { kind: "money", metric: { available: true, value: "13500" } },
    },
    {
      id: "profit-all-costs",
      label: "إجمالي تكاليف البزنس",
      lineType: "subtotal",
      value: { kind: "money", metric: { available: true, value: "3772.5" } },
    },
  ],
  result: { kind: "money", metric: { available: true, value: "9727.5" } },
};

/** CI-only fixture for N47/N48 Dashboard KPI drawer and deep-analysis behavior. */
export default function DashboardMetricDrawerFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار تفاصيل مؤشر الداشبورد">
        <article>
          <span>صافي الربح الحقيقي</span>
          <strong>٩٬٧٢٧٫٥ EGP</strong>
          <DashboardMetricDrawer
            audit={audit}
            currency="EGP"
            businessId={businessId}
            monthKey="2026-04"
          />
        </article>
      </section>
    </AppShell>
  );
}
