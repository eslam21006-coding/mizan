import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateSelfLiquidation,
  SelfLiquidationInputError,
} from "../../src/lib/business/self-liquidating.ts";

function availableValue<T>(metric: { available: boolean; value?: T }) {
  assert.equal(metric.available, true);
  if (!metric.available || metric.value === undefined) throw new Error("Expected available metric.");
  return metric.value;
}

test("Task 16 calculates exact Front-End liquidation with a >100% liquidation rate", () => {
  const result = calculateSelfLiquidation({
    frontEndRevenue: [
      { grossCash: "2000", refunds: "100" },
      { grossCash: "500", refunds: "100" },
    ],
    variableExpenses: [
      { expenseAmount: "500", allocatedAmount: "300" },
      { expenseAmount: "300", allocatedAmount: "200" },
    ],
    adSpend: "1500",
  });

  assert.equal(availableValue(result.frontEndNetCash), "2300");
  assert.equal(availableValue(result.frontEndVariableCosts), "500");
  assert.equal(availableValue(result.frontEndContributionProfit), "1800");
  assert.deepEqual(availableValue(result.adLiquidationRate), {
    numerator: "6",
    denominator: "5",
  });
  assert.equal(availableValue(result.effectiveRemainingAdCost), "-300");
  assert.equal(result.allocationComplete, true);
});

test("zero ad spend with known Front-End contribution keeps rate unavailable but remaining cost exact", () => {
  const result = calculateSelfLiquidation({
    frontEndRevenue: [{ grossCash: "1000", refunds: "0" }],
    variableExpenses: [{ expenseAmount: "100", allocatedAmount: "100" }],
    adSpend: "0",
  });

  assert.deepEqual(result.adLiquidationRate, { available: false, reason: "NO_AD_SPEND" });
  assert.equal(availableValue(result.effectiveRemainingAdCost), "-900");
});

test("missing Front-End revenue values fail closed instead of assuming zero", () => {
  const result = calculateSelfLiquidation({
    frontEndRevenue: [{ grossCash: null, refunds: "0" }],
    variableExpenses: [],
    adSpend: "100",
  });

  assert.deepEqual(result.frontEndNetCash, {
    available: false,
    reason: "FRONT_END_REVENUE_INCOMPLETE",
  });
  assert.deepEqual(result.frontEndContributionProfit, {
    available: false,
    reason: "FRONT_END_REVENUE_INCOMPLETE",
  });
  assert.deepEqual(result.adLiquidationRate, {
    available: false,
    reason: "FRONT_END_REVENUE_INCOMPLETE",
  });
});

test("positive variable costs require an explicit Front-End allocation", () => {
  const result = calculateSelfLiquidation({
    frontEndRevenue: [{ grossCash: "1000", refunds: "0" }],
    variableExpenses: [{ expenseAmount: "250", allocatedAmount: null }],
    adSpend: "500",
  });

  assert.deepEqual(result.frontEndVariableCosts, {
    available: false,
    reason: "VARIABLE_COST_ALLOCATION_INCOMPLETE",
  });
  assert.deepEqual(result.frontEndContributionProfit, {
    available: false,
    reason: "VARIABLE_COST_ALLOCATION_INCOMPLETE",
  });
  assert.equal(result.allocationComplete, false);
});

test("zero-value variable expense needs no fabricated allocation", () => {
  const result = calculateSelfLiquidation({
    frontEndRevenue: [{ grossCash: "100", refunds: "0" }],
    variableExpenses: [{ expenseAmount: "0", allocatedAmount: null }],
    adSpend: "100",
  });

  assert.equal(availableValue(result.frontEndVariableCosts), "0");
  assert.equal(result.allocationComplete, true);
});

test("missing canonical ad spend does not hide known Front-End contribution", () => {
  const result = calculateSelfLiquidation({
    frontEndRevenue: [{ grossCash: "800", refunds: "100" }],
    variableExpenses: [{ expenseAmount: "200", allocatedAmount: "150" }],
    adSpend: null,
  });

  assert.equal(availableValue(result.frontEndContributionProfit), "550");
  assert.deepEqual(result.adLiquidationRate, {
    available: false,
    reason: "AD_SPEND_UNAVAILABLE",
  });
  assert.deepEqual(result.effectiveRemainingAdCost, {
    available: false,
    reason: "AD_SPEND_UNAVAILABLE",
  });
});

test("stale Front-End allocation above the recalculated expense fails closed", () => {
  const result = calculateSelfLiquidation({
    frontEndRevenue: [{ grossCash: "100", refunds: "0" }],
    variableExpenses: [{ expenseAmount: "50", allocatedAmount: "51" }],
    adSpend: "100",
  });

  assert.deepEqual(result.frontEndVariableCosts, {
    available: false,
    reason: "VARIABLE_COST_ALLOCATION_INCOMPLETE",
  });
  assert.deepEqual(result.frontEndContributionProfit, {
    available: false,
    reason: "VARIABLE_COST_ALLOCATION_INCOMPLETE",
  });
  assert.deepEqual(result.adLiquidationRate, {
    available: false,
    reason: "VARIABLE_COST_ALLOCATION_INCOMPLETE",
  });
  assert.deepEqual(result.effectiveRemainingAdCost, {
    available: false,
    reason: "VARIABLE_COST_ALLOCATION_INCOMPLETE",
  });
  assert.equal(result.allocationComplete, false);
});

test("malformed allocation values still throw an input error", () => {
  assert.throws(
    () =>
      calculateSelfLiquidation({
        frontEndRevenue: [{ grossCash: "100", refunds: "0" }],
        variableExpenses: [{ expenseAmount: "50", allocatedAmount: "not-a-number" }],
        adSpend: "100",
      }),
    SelfLiquidationInputError,
  );
});

test("no Front-End streams is an exact zero rather than missing revenue", () => {
  const result = calculateSelfLiquidation({
    frontEndRevenue: [],
    variableExpenses: [],
    adSpend: "100",
  });

  assert.equal(availableValue(result.frontEndNetCash), "0");
  assert.equal(availableValue(result.frontEndContributionProfit), "0");
  assert.deepEqual(availableValue(result.adLiquidationRate), {
    numerator: "0",
    denominator: "1",
  });
  assert.equal(availableValue(result.effectiveRemainingAdCost), "100");
});
