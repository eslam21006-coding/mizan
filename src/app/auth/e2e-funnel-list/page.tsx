import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FunnelList } from "@/app/(app)/businesses/[businessId]/funnels/funnel-list";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};
const fixtureFunnels = [
  {
    id: "123e4567-e89b-42d3-a456-426614174001",
    name: "ويبينار البرنامج الأساسي",
    funnel_type: "webinar",
    is_active: true,
  },
  {
    id: "123e4567-e89b-42d3-a456-426614174002",
    name: "تحدي قديم",
    funnel_type: "lead_gen",
    is_active: false,
  },
] as const;

type FunnelListFixturePageProps = {
  searchParams: Promise<{ mode?: string }>;
};

/** CI-only fixture for N42 compact Funnel list states. */
export default async function FunnelListFixturePage({ searchParams }: FunnelListFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const canManage = query.mode !== "read-only";

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار قائمة الفانلز">
        <FunnelList businessId={businessId} funnels={fixtureFunnels} canManage={canManage} />
      </section>
    </AppShell>
  );
}
