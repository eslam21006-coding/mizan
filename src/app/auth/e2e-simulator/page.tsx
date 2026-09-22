import Link from "next/link";
import { notFound } from "next/navigation";
import { SimulatorReturnContextBanner } from "@/app/(app)/simulator/simulator-return-context";
import { SimulatorWorkspace } from "@/app/(app)/simulator/simulator-workspace";
import type { ScenarioEngineInput, ScenarioOverrides } from "@/lib/business/scenario-engine";
import {
  buildSimulatorHref,
  parseSimulatorTargetPlannerReturnContext,
  type SimulatorTargetPlannerReturnContext,
} from "@/lib/simulator-return-context";
import {
  deleteSimulatorFixtureScenario,
  duplicateSimulatorFixtureScenario,
  saveSimulatorFixtureScenario,
} from "./actions";

const FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-000000000034";
const BASELINE: Omit<ScenarioEngineInput, "overrides"> = {
  financial: {
    netCashCollected: "50000",
    allBusinessCosts: "30000",
    variableCosts: "10000",
    newCustomers: 50,
    adSpend: "10000",
  },
  funnel: {
    leads: 500,
    bookedCalls: 250,
    showedCalls: 200,
    qualifiedCalls: 150,
    sales: 60,
    newCustomers: 50,
  },
};

const SCENARIOS = {
  a: {
    id: "00000000-0000-4000-8000-000000000341",
    name: "سيناريو أ",
    creationRequestId: "00000000-0000-4000-8000-000000000342",
    overrides: { ad_spend: "12000" } satisfies ScenarioOverrides,
  },
  b: {
    id: "00000000-0000-4000-8000-000000000343",
    name: "سيناريو ب",
    creationRequestId: "00000000-0000-4000-8000-000000000344",
    overrides: { customer_value: "1100" } satisfies ScenarioOverrides,
  },
} as const;

/** Builds fixture scenario links with the same validated planner return context as production. */
function buildFixtureScenarioHref(
  returnContext: SimulatorTargetPlannerReturnContext | null,
  scenarioId?: "a" | "b",
) {
  if (!returnContext) {
    return scenarioId ? `/auth/e2e-simulator?scenario=${scenarioId}` : "/auth/e2e-simulator";
  }

  return buildSimulatorHref(
    {
      businessId: FIXTURE_BUSINESS_ID,
      month: "2026-08",
      scenarioId,
      returnContext,
    },
    "/auth/e2e-simulator",
  );
}

type SimulatorE2eFixturePageProps = {
  searchParams: Promise<{
    scenario?: string;
    origin?: string | string[];
    planner_business?: string | string[];
    planner_step?: string | string[];
    planner_goal?: string | string[];
    planner_value?: string | string[];
  }>;
};

/** CI-only Simulator fixture for N55 navigation, mutation redirects, and responsive checks. */
export default async function SimulatorE2eFixturePage({
  searchParams,
}: SimulatorE2eFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const returnContext = parseSimulatorTargetPlannerReturnContext(query);
  const selectedScenario =
    query.scenario === "a" ? SCENARIOS.a : query.scenario === "b" ? SCENARIOS.b : null;
  const workspaceKey = selectedScenario?.id ?? "new";

  return (
    <main className="page-stack">
      <h1>اختبار المحاكي</h1>
      <nav aria-label="سيناريوهات اختبار المحاكي">
        <Link href={buildFixtureScenarioHref(returnContext)}>سيناريو جديد</Link>{" "}
        <Link href={buildFixtureScenarioHref(returnContext, "a")}>فتح سيناريو أ</Link>{" "}
        <Link href={buildFixtureScenarioHref(returnContext, "b")}>فتح سيناريو ب</Link>
      </nav>
      <SimulatorReturnContextBanner context={returnContext} />
      <SimulatorWorkspace
        key={workspaceKey}
        businessId={FIXTURE_BUSINESS_ID}
        month="2026-08"
        currency="EGP"
        baseline={BASELINE}
        selectedScenario={selectedScenario}
        newCreationRequestId="00000000-0000-4000-8000-000000000345"
        duplicateCreationRequestId="00000000-0000-4000-8000-000000000346"
        canManage
        returnContext={returnContext}
        saveAction={saveSimulatorFixtureScenario}
        duplicateAction={duplicateSimulatorFixtureScenario}
        deleteAction={deleteSimulatorFixtureScenario}
      />
    </main>
  );
}
