import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { parseReturnOrigin } from "@/lib/return-origin";

const businessId = "123e4567-e89b-42d3-a456-426614174000";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type TargetPlannerReturnFixtureProps = {
  searchParams: Promise<{
    origin?: string | string[];
    planner_step?: string | string[];
    planner_goal?: string | string[];
    planner_value?: string | string[];
  }>;
};

/** CI-only fixture for the structured N54 Target Planner repair Return banner. */
export default async function TargetPlannerReturnE2eFixturePage({
  searchParams,
}: TargetPlannerReturnFixtureProps) {
  await connection();
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();

  const query = await searchParams;
  const parsed = parseReturnOrigin({
    origin: query.origin,
    planner_step: query.planner_step,
    planner_goal: query.planner_goal,
    planner_value: query.planner_value,
  });
  const returnOrigin = parsed?.origin === "target-planner" ? parsed : null;

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <PageHeading
          title="استكمال بيانات خطة الهدف"
          description="واجهة معزولة للتحقق من العودة إلى نفس خطوة Target Planner."
        />
        {returnOrigin && (
          <ReturnContextBanner
            purpose="البيانات الناقصة المطلوبة لإكمال خطة الوصول للهدف"
            origin={returnOrigin}
            context={{ businessId }}
            returnLabel="العودة إلى خطة الهدف"
            ariaLabel="سياق العودة إلى خطة الهدف"
          />
        )}
      </div>
    </AppShell>
  );
}
