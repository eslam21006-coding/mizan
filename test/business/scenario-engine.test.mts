import assert from "node:assert/strict";
import test from "node:test";

import type { ExactRatio } from "../../src/lib/business/calculations.ts";
import {
  calculateScenario,
  ScenarioEngineInputError,
  type ScenarioEngineInput,
} from "../../src/lib/business/scenario-engine.ts";

function ratio(numerator: number | string, denominator: number | string = 1): ExactRatio {
  return { numerator: String(numerator), denominator: String(denominator) };
}

function baseline(): ScenarioEngineInput {
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
  };
}

test("Task 33 untouched scenario reproduces the current month exactly", () => {
  const result = calculateScenario(baseline());

  assert.equal(result.funnel.available, true);
  if (!result.funnel.available) return;

  assert.deepEqual(result.funnel, {
    available: true,
    leads: 500,
    bookedCalls: 250,
    showedCalls: 200,
    qualifiedCalls: 150,
    sales: 60,
    newCustomers: 50,
    heldBookingRate: ratio(1, 2),
    heldSaleToNewCustomerRate: ratio(5, 6),
  });
  assert.deepEqual(result.financial.netCashCollected, ratio(50000));
  assert.deepEqual(result.financial.allBusinessCosts, ratio(30000));
  assert.deepEqual(result.financial.realNetProfit, ratio(20000));
  assert.deepEqual(result.financial.realNetProfitMargin, {
    available: true,
    value: ratio(2, 5),
  });
  assert.deepEqual(result.financial.ultimateCac, {
    available: true,
    value: ratio(600),
  });
  assert.deepEqual(result.financial.mediaCac, {
    available: true,
    value: ratio(200),
  });
  assert.deepEqual(result.financial.mer, {
    available: true,
    value: ratio(5),
  });
});

test("Task 33 projects funnel volume forward from Ad Spend and CPL with stage-by-stage floor", () => {
  const result = calculateScenario({
    ...baseline(),
    overrides: { ad_spend: "12000" },
  });

  assert.equal(result.funnel.available, true);
  if (!result.funnel.available) return;

  assert.deepEqual(result.funnel, {
    available: true,
    leads: 600,
    bookedCalls: 300,
    showedCalls: 240,
    qualifiedCalls: 180,
    sales: 72,
    newCustomers: 60,
    heldBookingRate: ratio(1, 2),
    heldSaleToNewCustomerRate: ratio(5, 6),
  });
  assert.deepEqual(result.financial.netCashCollected, ratio(60000));
  assert.deepEqual(result.financial.allBusinessCosts, ratio(34000));
  assert.deepEqual(result.financial.realNetProfit, ratio(26000));
  assert.deepEqual(result.financial.realNetProfitMargin, {
    available: true,
    value: ratio(13, 30),
  });
  assert.deepEqual(result.financial.ultimateCac, {
    available: true,
    value: ratio(1700, 3),
  });
});

test("Task 33 applies customer value and additive Upsell, Renewal, and Backend revenue without calling them LTV", () => {
  const result = calculateScenario({
    ...baseline(),
    overrides: {
      customer_value: "1100",
      upsells: "2500",
      renewals: "1500",
      backend_revenue: "5000",
    },
  });

  assert.deepEqual(result.financial.netCashCollected, ratio(64000));
  assert.deepEqual(result.financial.realNetProfit, ratio(34000));
  assert.deepEqual(result.financial.realNetProfitMargin, {
    available: true,
    value: ratio(17, 32),
  });
});

test("Task 33 applies fixed and effective per-new-customer variable costs without double-counting Ad Spend", () => {
  const result = calculateScenario({
    ...baseline(),
    overrides: {
      fixed_costs: "8000",
      variable_costs: "250",
      ad_spend: "10000",
    },
  });

  assert.deepEqual(result.financial.allBusinessCosts, ratio(30500));
  assert.deepEqual(result.financial.realNetProfit, ratio(19500));
  assert.deepEqual(result.financial.ultimateCac, {
    available: true,
    value: ratio(610),
  });
});

test("Task 33 keeps actual new customers fixed when a trustworthy funnel baseline is unavailable", () => {
  const input = baseline();
  input.funnel = null;
  input.overrides = { ad_spend: "12000" };

  const result = calculateScenario(input);

  assert.deepEqual(result.funnel, {
    available: false,
    reason: "FUNNEL_BASELINE_UNAVAILABLE",
    newCustomers: 50,
  });
  assert.deepEqual(result.financial.netCashCollected, ratio(50000));
  assert.deepEqual(result.financial.allBusinessCosts, ratio(32000));
  assert.deepEqual(result.financial.realNetProfit, ratio(18000));
});

test("Task 33 treats zero actual ad spend as unavailable funnel economics and unavailable MER", () => {
  const input = baseline();
  input.financial.adSpend = "0";

  const result = calculateScenario(input);

  assert.deepEqual(result.funnel, {
    available: false,
    reason: "FUNNEL_BASELINE_UNAVAILABLE",
    newCustomers: 50,
  });
  assert.deepEqual(result.financial.mer, {
    available: false,
    reason: "NO_AD_SPEND",
  });
  assert.deepEqual(result.controls.cpl.value, ratio(0));
  assert.deepEqual(result.financial.netCashCollected, ratio(50000));
  assert.deepEqual(result.financial.allBusinessCosts, ratio(30000));
});

test("Task 33 preserves exact baseline economics when per-customer value is a repeating fraction", () => {
  const result = calculateScenario({
    financial: {
      netCashCollected: "100",
      allBusinessCosts: "60",
      variableCosts: "30",
      newCustomers: 3,
      adSpend: "15",
    },
    funnel: null,
  });

  assert.deepEqual(result.controls.customer_value.value, ratio(100, 3));
  assert.deepEqual(result.controls.variable_costs.value, ratio(10));
  assert.deepEqual(result.financial.netCashCollected, ratio(100));
  assert.deepEqual(result.financial.allBusinessCosts, ratio(60));
  assert.deepEqual(result.financial.realNetProfit, ratio(40));
});

test("Task 33 allows a zero conversion scenario and fails denominator metrics closed", () => {
  const result = calculateScenario({
    ...baseline(),
    overrides: { close_rate: "0" },
  });

  assert.equal(result.funnel.available, true);
  if (!result.funnel.available) return;
  assert.equal(result.funnel.sales, 0);
  assert.equal(result.funnel.newCustomers, 0);
  assert.deepEqual(result.financial.netCashCollected, ratio(0));
  assert.deepEqual(result.financial.allBusinessCosts, ratio(20000));
  assert.deepEqual(result.financial.realNetProfit, ratio(-20000));
  assert.deepEqual(result.financial.realNetProfitMargin, {
    available: false,
    reason: "NON_POSITIVE_NET_CASH",
  });
  assert.deepEqual(result.financial.ultimateCac, {
    available: false,
    reason: "NO_NEW_CUSTOMERS",
  });
  assert.deepEqual(result.financial.mediaCac, {
    available: false,
    reason: "NO_NEW_CUSTOMERS",
  });
});

test("Task 33 rejects zero CPL when funnel-based customer projection is available", () => {
  assert.throws(
    () => calculateScenario({ ...baseline(), overrides: { cpl: "0" } }),
    (error: unknown) =>
      error instanceof ScenarioEngineInputError &&
      /CPL must be greater than zero/.test(error.message),
  );
});

test("Task 33 fails closed when the current cost basis cannot be decomposed safely", () => {
  const input = baseline();
  input.financial.allBusinessCosts = "15000";

  assert.throws(
    () => calculateScenario(input),
    /Current ad spend and variable costs exceed all business costs/,
  );
});

test("Task 33 rejects funnel totals that disagree with the business actual new-customer count", () => {
  const input = baseline();
  if (!input.funnel) return;
  input.funnel.newCustomers = 49;

  assert.throws(
    () => calculateScenario(input),
    /Funnel new-customer total must match the business monthly new-customer actual/,
  );
});
