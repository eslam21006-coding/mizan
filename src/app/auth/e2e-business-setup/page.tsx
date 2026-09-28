import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BusinessSetupShell } from "@/app/(app)/businesses/[businessId]/setup/business-setup-shell";
import {
  buildBusinessSetupHref,
  nextBusinessSetupStep,
  parseBusinessSetupStep,
  previousBusinessSetupStep,
  resolveBusinessSetupResumeStep,
} from "@/lib/business/setup-navigation";
import { resolveBusinessSetupReadiness } from "@/lib/business/setup-readiness";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";

type FixtureCase =
  | "empty"
  | "revenue"
  | "reviewed"
  | "complete"
  | "out-of-order"
  | "load-error";

const CASES: Record<
  Exclude<FixtureCase, "load-error">,
  { revenueSourceCount: number; reviewedAt: string | null; validMonthCount: number }
> = {
  empty: { revenueSourceCount: 0, reviewedAt: null, validMonthCount: 0 },
  revenue: { revenueSourceCount: 1, reviewedAt: null, validMonthCount: 0 },
  reviewed: {
    revenueSourceCount: 1,
    reviewedAt: "2026-09-28T10:00:00.000Z",
    validMonthCount: 0,
  },
  complete: {
    revenueSourceCount: 1,
    reviewedAt: "2026-09-28T10:00:00.000Z",
    validMonthCount: 1,
  },
  "out-of-order": {
    revenueSourceCount: 0,
    reviewedAt: "2026-09-28T10:00:00.000Z",
    validMonthCount: 1,
  },
};

type SetupFixturePageProps = {
  searchParams: Promise<{ case?: string; step?: string }>;
};

/** CI-only fixture that renders the production B04 setup shell from deterministic readiness facts. */
export default async function SetupFixturePage({ searchParams }: SetupFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const fixtureCase: FixtureCase =
    query.case === "revenue" ||
    query.case === "reviewed" ||
    query.case === "complete" ||
    query.case === "out-of-order" ||
    query.case === "load-error"
      ? query.case
      : "empty";
  const parsedStep = parseBusinessSetupStep(query.step);

  const readiness =
    fixtureCase === "load-error"
      ? resolveBusinessSetupReadiness({
          loadState: "load_error",
          revenueSourceCount: null,
          expenseSetupReviewedAt: null,
          validMonthCount: null,
        })
      : resolveBusinessSetupReadiness({
          loadState: "loaded",
          revenueSourceCount: CASES[fixtureCase].revenueSourceCount,
          expenseSetupReviewedAt: CASES[fixtureCase].reviewedAt,
          validMonthCount: CASES[fixtureCase].validMonthCount,
        });

  const resumeStep = resolveBusinessSetupResumeStep(readiness.coreSetup);
  const currentStep =
    parsedStep.kind === "valid"
      ? parsedStep.step
      : fixtureCase === "complete" && resumeStep === null
        ? null
        : resumeStep;
  const previousStep = currentStep ? previousBusinessSetupStep(currentStep) : null;
  const nextStep = currentStep ? nextBusinessSetupStep(currentStep) : null;
  const nextEnabled =
    fixtureCase !== "load-error" && currentStep !== null && readiness.stepComplete[currentStep];

  return (
    <AppShell role="admin" email="admin.fixture@example.test">
      <BusinessSetupShell
        businessId={businessId}
        businessName="أكاديمية ميزان"
        baseCurrency="USD"
        timezone="Africa/Cairo"
        currentStep={currentStep}
        readiness={readiness}
        canManage={fixtureCase !== "revenue"}
        revenueSourceCount={
          fixtureCase === "load-error" ? null : CASES[fixtureCase].revenueSourceCount
        }
        latestSavedMonthKey={
          fixtureCase !== "load-error" && CASES[fixtureCase].validMonthCount > 0
            ? "2026-08"
            : null
        }
        backHref={
          previousStep ? buildBusinessSetupHref(businessId, previousStep) : null
        }
        nextHref={
          nextEnabled
            ? nextStep
              ? buildBusinessSetupHref(businessId, nextStep)
              : buildBusinessSetupHref(businessId)
            : null
        }
        nextLabel={currentStep === "month" ? "إنهاء الإعداد" : "التالي"}
        nextEnabled={nextEnabled}
        loadError={fixtureCase === "load-error"}
      />
    </AppShell>
  );
}
