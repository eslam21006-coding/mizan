import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SimulatorScenarioStateBanner,
  SimulatorScenarioStateFields,
} from "@/app/(app)/simulator/simulator-scenario-state";
import { SimulatorWorkspace } from "@/app/(app)/simulator/simulator-workspace";
import type { ScenarioEngineInput, ScenarioOverrides } from "@/lib/business/scenario-engine";
import {
  persistentSimulatorScenarioId,
  resolveSimulatorScenarioState,
} from "@/lib/simulator-scenario-state";
import { buildSimulatorHref } from "@/lib/simulator-return-context";

const FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-000000000056";
const OTHER_BUSINESS_ID = "00000000-0000-4000-8000-000000000057";
const SCENARIO_A_ID = "00000000-0000-4000-8000-000000000561";
const SCENARIO_B_ID = "00000000-0000-4000-8000-000000000562";

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

const SCENARIOS = [
  {
    id: SCENARIO_A_ID,
    name: "سيناريو نمو",
    creationRequestId: "00000000-0000-4000-8000-000000000563",
    overrides: { ad_spend: "12000" } satisfies ScenarioOverrides,
  },
  {
    id: SCENARIO_B_ID,
    name: "سيناريو كفاءة",
    creationRequestId: "00000000-0000-4000-8000-000000000564",
    overrides: { customer_value: "1100" } satisfies ScenarioOverrides,
  },
] as const;

type ScenarioStateFixtureProps = {
  searchParams: Promise<{
    business?: string | string[];
    month?: string | string[];
    scenario?: string | string[];
  }>;
};

/** Reads one unambiguous fixture query value and rejects duplicate query state. */
function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

/** CI-only page that exercises N56 persistent scenario navigation state without database writes. */
export default async function SimulatorScenarioStateFixture({
  searchParams,
}: ScenarioStateFixtureProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();

  const query = await searchParams;
  const selectedBusinessId = single(query.business) ?? FIXTURE_BUSINESS_ID;
  const selectedMonth = single(query.month) === "2026-09" ? "2026-09" : "2026-08";
  const availableScenarios = selectedBusinessId === FIXTURE_BUSINESS_ID ? SCENARIOS : [];
  const scenarioState = resolveSimulatorScenarioState(query.scenario, availableScenarios);
  const selectedScenario =
    scenarioState.kind === "saved"
      ? SCENARIOS.find((scenario) => scenario.id === scenarioState.scenario.id) ?? null
      : null;
  const persistentScenarioId = persistentSimulatorScenarioId(scenarioState);

  const fixtureHref = (scenarioId?: string) =>
    buildSimulatorHref(
      {
        businessId: selectedBusinessId,
        month: selectedMonth,
        scenarioId,
      },
      "/auth/e2e-simulator-scenario-state",
    );

  return (
    <main className="page-stack">
      <h1>اختبار حالة السيناريو</h1>

      <nav aria-label="حالات السيناريو">
        <Link href={fixtureHref()}>سيناريو جديد</Link>{" "}
        <Link href={fixtureHref(SCENARIO_A_ID)}>فتح سيناريو نمو</Link>{" "}
        <Link href={fixtureHref(SCENARIO_B_ID)}>فتح سيناريو كفاءة</Link>
      </nav>

      <SimulatorScenarioStateBanner state={scenarioState} />

      <section aria-label="اختبار تنقل حالة السيناريو">
        <form aria-label="تغيير الشهر المرجعي">
          <input type="hidden" name="business" value={selectedBusinessId} />
          <SimulatorScenarioStateFields state={scenarioState} />
          <label>
            الشهر
            <select name="month" defaultValue={selectedMonth}>
              <option value="2026-08">أغسطس 2026</option>
              <option value="2026-09">سبتمبر 2026</option>
            </select>
          </label>
          <button type="submit">فتح الشهر</button>
        </form>

        <form aria-label="تغيير البزنس">
          <input type="hidden" name="month" value={selectedMonth} />
          <label>
            البزنس
            <select name="business" defaultValue={selectedBusinessId}>
              <option value={FIXTURE_BUSINESS_ID}>البزنس الأساسي</option>
              <option value={OTHER_BUSINESS_ID}>بزنس آخر</option>
            </select>
          </label>
          <button type="submit">فتح البزنس</button>
        </form>
      </section>

      {scenarioState.kind === "unavailable" ? (
        <section role="status">
          <p>لن يتم عرض مساحة العمل حتى يختار المستخدم سيناريو صالحًا أو يبدأ واحدًا جديدًا.</p>
          <Link href={fixtureHref()}>بدء سيناريو جديد</Link>
        </section>
      ) : (
        <SimulatorWorkspace
          key={`${selectedBusinessId}:${selectedMonth}:${persistentScenarioId ?? "new"}`}
          businessId={selectedBusinessId}
          month={selectedMonth}
          currency="EGP"
          baseline={BASELINE}
          selectedScenario={selectedScenario}
          newCreationRequestId="00000000-0000-4000-8000-000000000565"
          duplicateCreationRequestId="00000000-0000-4000-8000-000000000566"
          canManage={false}
        />
      )}
    </main>
  );
}
