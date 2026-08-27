import type { ExactRatio } from "./calculations.ts";
import { subtractExactRatios } from "./exact-rational.ts";
import {
  calculateScenario,
  type ScenarioEngineInput,
  type ScenarioEngineResult,
  type ScenarioMetric,
} from "./scenario-engine.ts";

export type ScenarioExactChange = {
  current: ExactRatio;
  scenario: ExactRatio;
  delta: ExactRatio;
};

export type ScenarioMetricChange = {
  current: ScenarioMetric<ExactRatio>;
  scenario: ScenarioMetric<ExactRatio>;
  delta: ScenarioMetric<ExactRatio>;
};

export type ScenarioCountChange = {
  current: number;
  scenario: number;
  delta: number;
};

export type CurrentScenarioComparison = {
  current: ScenarioEngineResult;
  scenario: ScenarioEngineResult;
  financial: {
    netCashCollected: ScenarioExactChange;
    realNetProfit: ScenarioExactChange;
    realNetProfitMargin: ScenarioMetricChange;
    ultimateCac: ScenarioMetricChange;
    adSpend: ScenarioExactChange;
    cpl: ScenarioMetricChange;
    newCustomers: ScenarioCountChange;
  };
  funnel:
    | {
        available: true;
        leads: ScenarioCountChange;
        bookedCalls: ScenarioCountChange;
        showedCalls: ScenarioCountChange;
        qualifiedCalls: ScenarioCountChange;
        sales: ScenarioCountChange;
        newCustomers: ScenarioCountChange;
      }
    | { available: false; reason: "FUNNEL_BASELINE_UNAVAILABLE" };
};

function exactChange(current: ExactRatio, scenario: ExactRatio): ScenarioExactChange {
  return { current, scenario, delta: subtractExactRatios(scenario, current) };
}

function metricChange(
  current: ScenarioMetric<ExactRatio>,
  scenario: ScenarioMetric<ExactRatio>,
): ScenarioMetricChange {
  const delta: ScenarioMetric<ExactRatio> =
    current.available && scenario.available
      ? { available: true, value: subtractExactRatios(scenario.value, current.value) }
      : scenario.available
        ? current
        : scenario;
  return { current, scenario, delta };
}

function countChange(current: number, scenario: number): ScenarioCountChange {
  return { current, scenario, delta: scenario - current };
}

/**
 * Task 34 always compares the scenario to an untouched calculation from the same historical baseline.
 * This avoids mutating or reinterpreting actuals and gives the default scenario an exact identity check.
 */
export function compareCurrentToScenario(input: ScenarioEngineInput): CurrentScenarioComparison {
  const current = calculateScenario({
    financial: input.financial,
    funnel: input.funnel,
    overrides: {},
  });
  const scenario = calculateScenario(input);

  const currentNewCustomers = current.funnel.newCustomers;
  const scenarioNewCustomers = scenario.funnel.newCustomers;

  const currentCpl: ScenarioMetric<ExactRatio> = current.funnel.available
    ? { available: true, value: current.controls.cpl.value }
    : { available: false, reason: "FUNNEL_BASELINE_UNAVAILABLE" };
  const scenarioCpl: ScenarioMetric<ExactRatio> = scenario.funnel.available
    ? { available: true, value: scenario.controls.cpl.value }
    : { available: false, reason: "FUNNEL_BASELINE_UNAVAILABLE" };

  const funnel =
    current.funnel.available && scenario.funnel.available
      ? {
          available: true as const,
          leads: countChange(current.funnel.leads, scenario.funnel.leads),
          bookedCalls: countChange(current.funnel.bookedCalls, scenario.funnel.bookedCalls),
          showedCalls: countChange(current.funnel.showedCalls, scenario.funnel.showedCalls),
          qualifiedCalls: countChange(
            current.funnel.qualifiedCalls,
            scenario.funnel.qualifiedCalls,
          ),
          sales: countChange(current.funnel.sales, scenario.funnel.sales),
          newCustomers: countChange(current.funnel.newCustomers, scenario.funnel.newCustomers),
        }
      : { available: false as const, reason: "FUNNEL_BASELINE_UNAVAILABLE" as const };

  return {
    current,
    scenario,
    financial: {
      netCashCollected: exactChange(
        current.financial.netCashCollected,
        scenario.financial.netCashCollected,
      ),
      realNetProfit: exactChange(
        current.financial.realNetProfit,
        scenario.financial.realNetProfit,
      ),
      realNetProfitMargin: metricChange(
        current.financial.realNetProfitMargin,
        scenario.financial.realNetProfitMargin,
      ),
      ultimateCac: metricChange(current.financial.ultimateCac, scenario.financial.ultimateCac),
      adSpend: exactChange(current.controls.ad_spend.value, scenario.controls.ad_spend.value),
      cpl: metricChange(currentCpl, scenarioCpl),
      newCustomers: countChange(currentNewCustomers, scenarioNewCustomers),
    },
    funnel,
  };
}
