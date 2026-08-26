import assert from "node:assert/strict";
import test from "node:test";

import type { ExactRatio } from "../../src/lib/business/calculations.ts";
import {
  calculateSustainableAcquisitionEconomics,
  SustainableAcquisitionInputError,
} from "../../src/lib/business/sustainable-acquisition.ts";

function ratio(numerator: number | string, denominator: number | string = 1): ExactRatio {
  return { numerator: String(numerator), denominator: String(denominator) };
}

function baseInput() {
  return {
    requiredRevenue: ratio(50000),
    requiredCustomers: 50,
    requiredLeads: 500,
    profitConstraintAmount: ratio(0),
    monthlyFixedAcquisitionCosts: ratio(3000),
    monthlyFixedNonAcquisitionCosts: ratio(6000),
    variableNonMediaAcquisitionCostPerNewCustomer: ratio(100),
    variableNonAcquisitionCostPerNewCustomer: ratio(200),
  };
}

test("Task 31 calculates the revenue-target sustainable Acquisition CAC, Media CAC, and CPL exactly", () => {
  const result = calculateSustainableAcquisitionEconomics(baseInput());

  assert.deepEqual(result.projectedNonAcquisitionCosts, ratio(16000));
  assert.deepEqual(result.mandatoryNonMediaAcquisitionCosts, ratio(8000));
  assert.deepEqual(result.mandatoryNonMediaAcquisitionCostPerCustomer, ratio(160));
  assert.deepEqual(result.acquisitionBudgetHeadroom, ratio(34000));
  assert.deepEqual(result.mediaBudgetHeadroom, ratio(26000));
  assert.deepEqual(result.maximumSustainableAcquisitionCac, {
    available: true,
    value: ratio(680),
  });
  assert.deepEqual(result.maximumMediaCac, {
    available: true,
    value: ratio(520),
  });
  assert.deepEqual(result.maximumCpl, {
    available: true,
    value: ratio(52),
  });
});

test("Task 31 preserves the exact Net Profit target economics from Task 29", () => {
  const result = calculateSustainableAcquisitionEconomics({
    ...baseInput(),
    requiredRevenue: ratio(58000),
    requiredCustomers: 58,
    requiredLeads: 586,
    profitConstraintAmount: ratio(20000),
  });

  assert.deepEqual(result.projectedNonAcquisitionCosts, ratio(17600));
  assert.deepEqual(result.acquisitionBudgetHeadroom, ratio(20400));
  assert.deepEqual(result.mandatoryNonMediaAcquisitionCosts, ratio(8800));
  assert.deepEqual(result.mediaBudgetHeadroom, ratio(11600));
  assert.deepEqual(result.maximumSustainableAcquisitionCac, {
    available: true,
    value: ratio(10200, 29),
  });
  assert.deepEqual(result.maximumMediaCac, {
    available: true,
    value: ratio(200),
  });
  assert.deepEqual(result.maximumCpl, {
    available: true,
    value: ratio(5800, 293),
  });
});

test("Task 31 preserves the exact 40% margin-target sustainable ceilings", () => {
  const result = calculateSustainableAcquisitionEconomics({
    ...baseInput(),
    requiredRevenue: ratio(90000),
    requiredCustomers: 90,
    requiredLeads: 900,
    profitConstraintAmount: ratio(36000),
  });

  assert.deepEqual(result.projectedNonAcquisitionCosts, ratio(24000));
  assert.deepEqual(result.acquisitionBudgetHeadroom, ratio(30000));
  assert.deepEqual(result.mandatoryNonMediaAcquisitionCosts, ratio(12000));
  assert.deepEqual(result.mediaBudgetHeadroom, ratio(18000));
  assert.deepEqual(result.maximumSustainableAcquisitionCac, {
    available: true,
    value: ratio(1000, 3),
  });
  assert.deepEqual(result.maximumMediaCac, {
    available: true,
    value: ratio(200),
  });
  assert.deepEqual(result.maximumCpl, {
    available: true,
    value: ratio(20),
  });
});

test("Task 31 fails closed when non-acquisition economics already exceed the sustainability budget", () => {
  const result = calculateSustainableAcquisitionEconomics({
    ...baseInput(),
    requiredRevenue: ratio(5000),
    requiredCustomers: 5,
    requiredLeads: 50,
  });

  assert.deepEqual(result.projectedNonAcquisitionCosts, ratio(7000));
  assert.deepEqual(result.acquisitionBudgetHeadroom, ratio(-2000));
  assert.deepEqual(result.maximumSustainableAcquisitionCac, {
    available: false,
    reason: "NO_ACQUISITION_HEADROOM",
  });
  assert.deepEqual(result.maximumMediaCac, {
    available: false,
    reason: "NO_MEDIA_HEADROOM",
  });
  assert.deepEqual(result.maximumCpl, {
    available: false,
    reason: "MAX_MEDIA_CAC_UNAVAILABLE",
  });
});

test("Task 31 can have Acquisition CAC headroom but no Media CAC headroom after mandatory non-media acquisition costs", () => {
  const result = calculateSustainableAcquisitionEconomics({
    requiredRevenue: ratio(10000),
    requiredCustomers: 10,
    requiredLeads: 100,
    profitConstraintAmount: ratio(0),
    monthlyFixedAcquisitionCosts: ratio(9500),
    monthlyFixedNonAcquisitionCosts: ratio(0),
    variableNonMediaAcquisitionCostPerNewCustomer: ratio(100),
    variableNonAcquisitionCostPerNewCustomer: ratio(0),
  });

  assert.deepEqual(result.maximumSustainableAcquisitionCac, {
    available: true,
    value: ratio(1000),
  });
  assert.deepEqual(result.mandatoryNonMediaAcquisitionCostPerCustomer, ratio(1050));
  assert.deepEqual(result.mediaBudgetHeadroom, ratio(-500));
  assert.deepEqual(result.maximumMediaCac, {
    available: false,
    reason: "NO_MEDIA_HEADROOM",
  });
  assert.deepEqual(result.maximumCpl, {
    available: false,
    reason: "MAX_MEDIA_CAC_UNAVAILABLE",
  });
});

test("Task 31 treats an exact zero sustainability ceiling as a valid zero rather than missing data", () => {
  const result = calculateSustainableAcquisitionEconomics({
    requiredRevenue: ratio(1000),
    requiredCustomers: 10,
    requiredLeads: 100,
    profitConstraintAmount: ratio(1000),
    monthlyFixedAcquisitionCosts: ratio(0),
    monthlyFixedNonAcquisitionCosts: ratio(0),
    variableNonMediaAcquisitionCostPerNewCustomer: ratio(0),
    variableNonAcquisitionCostPerNewCustomer: ratio(0),
  });

  assert.deepEqual(result.acquisitionBudgetHeadroom, ratio(0));
  assert.deepEqual(result.mediaBudgetHeadroom, ratio(0));
  assert.deepEqual(result.maximumSustainableAcquisitionCac, {
    available: true,
    value: ratio(0),
  });
  assert.deepEqual(result.maximumMediaCac, {
    available: true,
    value: ratio(0),
  });
  assert.deepEqual(result.maximumCpl, {
    available: true,
    value: ratio(0),
  });
});

test("Task 31 rejects invalid planning counts and negative cost inputs", () => {
  assert.throws(
    () => calculateSustainableAcquisitionEconomics({ ...baseInput(), requiredLeads: 0 }),
    /requiredLeads must be a positive safe integer/,
  );
  assert.throws(
    () =>
      calculateSustainableAcquisitionEconomics({
        ...baseInput(),
        monthlyFixedAcquisitionCosts: ratio(-1),
      }),
    (error: unknown) =>
      error instanceof SustainableAcquisitionInputError &&
      /monthlyFixedAcquisitionCosts cannot be negative/.test(error.message),
  );
});
