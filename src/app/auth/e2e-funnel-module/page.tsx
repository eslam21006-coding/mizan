import { notFound } from "next/navigation";
import { FunnelHierarchyBack } from "@/app/(app)/businesses/[businessId]/funnel-hierarchy-back";
import { FunnelModuleShell } from "@/app/(app)/businesses/[businessId]/funnel-module-shell";
import { FunnelCreateDrawerLauncher } from "@/app/(app)/businesses/[businessId]/funnels/funnel-create-drawer";
import { FunnelList } from "@/app/(app)/businesses/[businessId]/funnels/funnel-list";
import { LiquidationMissingDataActions } from "@/app/(app)/businesses/[businessId]/liquidation/liquidation-missing-data-actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { FUNNEL_TYPE_OPTIONS } from "@/lib/business/funnels";
import type { FunnelModuleTab } from "@/lib/funnel-module";
import { parseFunnelMonthlyReturnOrigin } from "@/lib/funnel-monthly-return-origin";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";
const creationRequestId = "123e4567-e89b-42d3-a456-426614174010";
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

type FunnelModuleFixturePageProps = {
  searchParams: Promise<{
    journey?: string;
    tab?: string;
    month?: string;
    origin?: string | string[];
  }>;
};

/** Restricts the fixture to the three supported Funnel module tab states. */
function parseTab(value: string | undefined): FunnelModuleTab {
  return value === "monthly" || value === "liquidation" ? value : "structure";
}

/** Renders the N71 Structure stage using the real in-context create/edit Funnel components. */
function FunnelStructureJourneyStage() {
  return (
    <>
      <PageHeader
        title="الفانلز"
        description="عرّف الفانلز هنا ثم انتقل للأداء الشهري أو تسييل الإنفاق من نفس الوحدة."
        actionState="normal"
        actionsAriaLabel="إجراءات الفانلز"
        actions={
          <FunnelCreateDrawerLauncher
            businessId={businessId}
            typeOptions={FUNNEL_TYPE_OPTIONS}
            creationRequestId={creationRequestId}
          />
        }
      />
      <section aria-label="رحلة هيكل الفانلز">
        <FunnelList businessId={businessId} funnels={fixtureFunnels} canManage />
      </section>
    </>
  );
}

/** Renders the N71 Monthly stage while relying on the real module shell and Return banner. */
function FunnelMonthlyJourneyStage({ monthKey }: { monthKey: string }) {
  return (
    <section className="shell-card" aria-label="رحلة الأداء الشهري للفانلز">
      <h1>أرقام الفانلز الشهرية</h1>
      <p>{monthKey}</p>
    </section>
  );
}

/** Renders the N71 Liquidation stage with the real deterministic missing-data action component. */
function FunnelLiquidationJourneyStage({ monthKey }: { monthKey: string }) {
  return (
    <section className="page-stack" aria-label="رحلة تسييل الإنفاق">
      <div className="shell-card">
        <h1>تسييل الإنفاق الإعلاني</h1>
        <p>{monthKey}</p>
      </div>
      <LiquidationMissingDataActions
        businessId={businessId}
        monthKey={monthKey}
        revenueIncomplete={false}
        adSpendMissing
        allocationIncomplete={false}
      />
    </section>
  );
}

/** CI-only fixture for persistent Funnel navigation and the N71 integrated Funnel workflow. */
export default async function FunnelModuleFixturePage({
  searchParams,
}: FunnelModuleFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const activeTab = parseTab(query.tab);
  const monthKey = query.month ?? "2026-09";
  const journey = query.journey === "1";
  const returnOrigin =
    activeTab === "monthly"
      ? parseFunnelMonthlyReturnOrigin({ origin: query.origin })
      : null;

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار وحدة الفانلز">
        <FunnelModuleShell
          businessId={businessId}
          activeTab={activeTab}
          monthKey={monthKey}
          origin={returnOrigin?.origin === "funnel-structure" ? returnOrigin.origin : undefined}
        />
        <FunnelHierarchyBack
          businessId={businessId}
          monthKey={activeTab === "structure" ? null : monthKey}
        />
        {returnOrigin && (
          <ReturnContextBanner
            purpose="أرقام الفانلز الشهرية"
            origin={returnOrigin}
            context={{ businessId }}
            returnLabel="العودة إلى هيكل الفانلز"
            ariaLabel="سياق العودة من أرقام الفانلز الشهرية"
          />
        )}

        {journey ? (
          activeTab === "structure" ? (
            <FunnelStructureJourneyStage />
          ) : activeTab === "monthly" ? (
            <FunnelMonthlyJourneyStage monthKey={monthKey} />
          ) : (
            <FunnelLiquidationJourneyStage monthKey={monthKey} />
          )
        ) : (
          <section className="shell-card">
            <strong>
              {activeTab === "structure"
                ? "هيكل الفانلز"
                : activeTab === "monthly"
                  ? "الأداء الشهري"
                  : "تسييل الإنفاق"}
            </strong>
          </section>
        )}
      </section>
    </AppShell>
  );
}
