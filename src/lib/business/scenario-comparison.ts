import type { ExactRatio } from "./calculations.ts";
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

type Rational = { numerator: bigint; denominator: bigint };

function gcd(left: bigint, right: bigint) {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function normalize(value: Rational): Rational {
  if (value.denominator === 0n) throw new Error("Comparison ratio denominator cannot be zero.");
  if (value.numerator === 0n) return { numerator: 0n, denominator: 1n };
  const sign = value.denominator < 0n ? -1n : 1n;
  const numerator = value.numerator * sign;
  const denominator = value.denominator * sign;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function rational(value: ExactRatio): Rational {
  return normalize({ numerator: BigInt(value.numerator), denominator: BigInt(value.denominator) });
}

function exact(value: Rational): ExactRatio {
  const normalized = normalize(value);
  return {
    numerator: normalized.numerator.toString(),
    denominator: normalized.denominator.toString(),
  };
}

function subtract(left: ExactRatio, right: ExactRatio): ExactRatio {
  const a = rational(left);
  const b = rational(right);
  return exact({
    numerator: a.numerator * b.denominator - b.numerator * a.denominator,
    denominator: a.denominator * b.denominator,
  });
}

function exactChange(current: ExactRatio, scenario: ExactRatio): ScenarioExactChange {
  return { current, scenario, delta: subtract(scenario, current) };
}

function metricChange(
  current: ScenarioMetric<ExactRatio>,
  scenario: ScenarioMetric<ExactRatio>,
): ScenarioMetricChange {
  const delta: ScenarioMetric<ExactRatio> =
    current.available && scenario.available
      ? { available: true, value: subtract(scenario.value, current.value) }
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
    : { available: false, reason: "NO_NEW_CUSTOMERS" };
  const scenarioCpl: ScenarioMetric<ExactRatio> = scenario.funnel.available
    ? { available: true, value: scenario.controls.cpl.value }
    : { available: false, reason: "NO_NEW_CUSTOMERS" };

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
