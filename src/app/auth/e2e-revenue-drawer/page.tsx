import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { REVENUE_STREAM_TYPE_OPTIONS } from "@/lib/business/revenue-streams";
import type { SetupReturnOrigin } from "@/lib/setup-return-origin";
import { RevenueStreamDrawerLauncher } from "@/app/(app)/businesses/[businessId]/revenue-streams/revenue-stream-drawer";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

const returnOrigin: SetupReturnOrigin = {
  origin: "monthly-editor",
  month: "2026-09",
  upstream: {
    origin: "customer-profitability",
    month: "2026-07",
  },
};

/** CI-only fixture for the N30/N31 Revenue Source drawer without database dependencies. */
export default function RevenueDrawerFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <main className="page-stack" aria-label="اختبار درج مصادر الإيراد">
        <section className="panel">
          <h1>إدارة مصادر الإيراد</h1>
          <p className="muted-copy">واجهة اختبار معزولة لسلوك الإضافة والتعديل داخل الدرج.</p>
          <RevenueStreamDrawerLauncher
            businessId="123e4567-e89b-42d3-a456-426614174000"
            returnOrigin={returnOrigin}
            typeOptions={REVENUE_STREAM_TYPE_OPTIONS}
            mode="create"
            creationRequestId="123e4567-e89b-42d3-a456-426614174011"
          />
        </section>

        <section className="panel">
          <h2>البرنامج الأساسي</h2>
          <RevenueStreamDrawerLauncher
            businessId="123e4567-e89b-42d3-a456-426614174000"
            returnOrigin={returnOrigin}
            typeOptions={REVENUE_STREAM_TYPE_OPTIONS}
            mode="edit"
            stream={{
              id: "123e4567-e89b-42d3-a456-426614174012",
              name: "البرنامج الأساسي",
              stream_type: "front_end",
              is_active: true,
            }}
          />
        </section>
      </main>
    </AppShell>
  );
}
