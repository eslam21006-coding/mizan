import assert from "node:assert/strict";
import test from "node:test";

import type { ExactRatio } from "../../src/lib/business/calculations.ts";
import { compareCurrentToScenario } from "../../src/lib/business/scenario-comparison.ts";
import type { ScenarioEngineInput } from "../../src/lib/business/scenario-engine.ts";

function ratio(numerator: number | string, denominator: number | string = 1): ExactRatio {
  return { numerator: String(numerator), denominator: String(denominator) };
}

function input(overrides: ScenarioEngineInput["overrides"] = {}): ScenarioEngineInput {
  return {
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
    overrides,
  };
}

test("Task 34 untouched scenario is an exact Current = Scenario identity", () => {
  const comparison = compareCurrentToScenario(input());

  assert.deepEqual(comparison.financial.netCashCollected, {
    current: ratio(50000),
    scenario: ratio(50000),
    delta: ratio(0),
  });
  assert.deepEqual(comparison.financial.realNetProfit, {
    current: ratio(20000),
    scenario: ratio(20000),
    delta: ratio(0),
  });
  assert.deepEqual(comparison.financial.realNetProfitMargin, {
    current: { available: true, value: ratio(2, 5) },
    scenario: { available: true, value: ratio(2, 5) },
    delta: { available: true, value: ratio(0) },
  });
  assert.deepEqual(comparison.financial.ultimateCac, {
    current: { available: true, value: ratio(600) },
    scenario: { available: true, value: ratio(600) },
    delta: { available: true, value: ratio(0) },
  });
  assert.deepEqual(comparison.financial.adSpend, {
    current: ratio(10000),
    scenario: ratio(10000),
    delta: ratio(0),
  });
  assert.deepEqual(comparison.financial.cpl, {
    current: { available: true, value: ratio(20) },
    scenario: { available: true, value: ratio(20) },
    delta: { available: true, value: ratio(0) },
  });
  assert.deepEqual(comparison.financial.newCustomers, {
    current: 50,
    scenario: 50,
    delta: 0,
  });
  assert.equal(comparison.funnel.available, true);
  if (!comparison.funnel.available) return;
  assert.equal(comparison.funnel.leads.delta, 0);
  assert.equal(comparison.funnel.bookedCalls.delta, 0);
  assert.equal(comparison.funnel.showedCalls.delta, 0);
  assert.equal(comparison.funnel.qualifiedCalls.delta, 0);
  assert.equal(comparison.funnel.sales.delta, 0);
  assert.equal(comparison.funnel.newCustomers.delta, 0);
});

test("Task 34 returns exact financial and funnel deltas after a scenario change", () => {
  const comparison = compareCurrentToScenario(input({ ad_spend: "12000" }));

  assert.deepEqual(comparison.financial.netCashCollected, {
    current: ratio(50000),
    scenario: ratio(60000),
    delta: ratio(10000),
  });
  assert.deepEqual(comparison.financial.realNetProfit, {
    current: ratio(20000),
    scenario: ratio(26000),
    delta: ratio(6000),
  });
  assert.deepEqual(comparison.financial.realNetProfitMargin.delta, {
    available: true,
    value: ratio(1, 30),
  });
  assert.deepEqual(comparison.financial.ultimateCac.delta, {
    available: true,
    value: ratio(-100, 3),
  });
  assert.deepEqual(comparison.financial.adSpend.delta, ratio(2000));
  assert.deepEqual(comparison.financial.newCustomers, {
    current: 50,
    scenario: 60,
    delta: 10,
  });
  assert.equal(comparison.funnel.available, true);
  if (!comparison.funnel.available) return;
  assert.deepEqual(comparison.funnel.leads, { current: 500, scenario: 600, delta: 100 });
  assert.deepEqual(comparison.funnel.sales, { current: 60, scenario: 72, delta: 12 });
});

test("Task 34 marks funnel comparison unavailable when historical funnel actuals are insufficient", () => {
  const baseline = input({ customer_value: "1100" });
  baseline.funnel = null;
  const comparison = compareCurrentToScenario(baseline);

  assert.deepEqual(comparison.funnel, {
    available: false,
    reason: "FUNNEL_BASELINE_UNAVAILABLE",
  });
  assert.deepEqual(comparison.financial.newCustomers, {
    current: 50,
    scenario: 50,
    delta: 0,
  });
  assert.deepEqual(comparison.financial.netCashCollected.delta, ratio(5000));
});

test("Task 34 propagates unavailable denominator metrics instead of inventing a percentage", () => {
  const comparison = compareCurrentToScenario(input({ close_rate: "0" }));

  assert.deepEqual(comparison.financial.realNetProfitMargin.scenario, {
    available: false,
    reason: "NON_POSITIVE_NET_CASH",
  });
  assert.deepEqual(comparison.financial.ultimateCac.scenario, {
    available: false,
    reason: "NO_NEW_CUSTOMERS",
  });
  assert.equal(comparison.financial.realNetProfitMargin.delta.available, false);
  assert.equal(comparison.financial.ultimateCac.delta.available, false);
});
