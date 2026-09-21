import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { FunnelCreateDrawerLauncher } from "@/app/(app)/businesses/[businessId]/funnels/funnel-create-drawer";
import { FUNNEL_TYPE_OPTIONS } from "@/lib/business/funnels";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";
const creationRequestId = "123e4567-e89b-42d3-a456-426614174010";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type FunnelCreateDrawerFixturePageProps = {
  searchParams: Promise<{ mode?: string }>;
};

/** CI-only fixture for N43 Funnel create drawer states. */
export default async function FunnelCreateDrawerFixturePage({
  searchParams,
}: FunnelCreateDrawerFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const canManage = query.mode !== "read-only";

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار إضافة فانل">
        <PageHeader
          title="الفانلز"
          description="اختبار إنشاء فانل داخل نفس سياق الهيكل."
          actionState={canManage ? "normal" : "read-only"}
          actionsAriaLabel="إجراءات الفانلز"
          actions={
            canManage ? (
              <FunnelCreateDrawerLauncher
                businessId={businessId}
                typeOptions={FUNNEL_TYPE_OPTIONS}
                creationRequestId={creationRequestId}
              />
            ) : undefined
          }
        />
      </section>
    </AppShell>
  );
}
