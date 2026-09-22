import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TargetPlanSteps } from "@/app/(app)/target-plan/target-plan-steps";
import { parseTargetPlannerStep } from "@/lib/target-planner-step";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type SearchParamValue = string | string[] | undefined;

type TargetPlanStepsFixtureProps = {
  searchParams: Promise<{
    business?: SearchParamValue;
    goal?: SearchParamValue;
    value?: SearchParamValue;
    step?: SearchParamValue;
  }>;
};

/** Resolves one fixture query value while rejecting duplicate-array state. */
function single(value: SearchParamValue, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

/** CI-only fixture for N53 URL-backed Target Planner workflow steps. */
export default async function TargetPlanStepsFixturePage({
  searchParams,
}: TargetPlanStepsFixtureProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const activeStep = parseTargetPlannerStep(query.step);
  const businessId = single(query.business, "business fixture/01");
  const goal = single(query.goal, "revenue");
  const value = typeof query.value === "string" ? query.value : undefined;

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <h1>خطة الوصول للهدف</h1>
        <TargetPlanSteps
          activeStep={activeStep}
          state={{ businessId, goal, value }}
          basePath="/auth/e2e-target-plan-steps"
        />

        {activeStep === "goal" && (
          <section className="panel" data-testid="planner-step-goal">
            <h2>حدد الهدف</h2>
            <form>
              <input type="hidden" name="business" value={businessId} />
              <input type="hidden" name="step" value="plan" />
              <input type="hidden" name="goal" value={goal} />
              <label>
                القيمة
                <input name="value" defaultValue={value ?? ""} />
              </label>
              <button type="submit">احسب الخطة</button>
            </form>
          </section>
        )}

        {activeStep === "assumptions" && (
          <section className="panel" data-testid="planner-step-assumptions">
            <h2>الافتراضات المستخدمة</h2>
          </section>
        )}

        {activeStep === "plan" && (
          <section className="panel" data-testid="planner-step-plan">
            <h2>الخطة</h2>
          </section>
        )}
      </div>
    </AppShell>
  );
}
