import assert from "node:assert/strict";
import test from "node:test";

import type { ExactRatio } from "../../src/lib/business/calculations.ts";
import {
  planTarget,
  resolveRolling3TargetAssumptions,
  type Rolling3TargetActualMonth,
  type TargetPlannerAssumptions,
} from "../../src/lib/business/target-engine.ts";

function ratio(numerator: number | string, denominator: number | string = 1): ExactRatio {
  return { numerator: String(numerator), denominator: String(denominator) };
}

function manualAssumptions(): TargetPlannerAssumptions {
  return {
    source: { kind: "manual" },
    revenuePerNewCustomer: ratio(1000),
    monthlyFixedAcquisitionCosts: ratio(3000),
    monthlyFixedNonAcquisitionCosts: ratio(6000),
    variableNonMediaAcquisitionCostPerNewCustomer: ratio(100),
    variableNonAcquisitionCostPerNewCustomer: ratio(200),
    assumedMediaCac: ratio(200),
    bookingRate: ratio(1, 2),
    showRate: ratio(4, 5),
    qualificationRate: ratio(3, 4),
    closeRate: ratio(2, 5),
    saleToNewCustomerRate: ratio(5, 6),
  };
}

function actualMonth(month: string): Rolling3TargetActualMonth {
  return {
    month,
    netCashCollected: "30000",
    newCustomers: 30,
    adSpend: "6000",
    fixedAcquisitionCosts: "3000",
    fixedNonAcquisitionCosts: "6000",
    variableNonMediaAcquisitionCosts: "3000",
    variableNonAcquisitionCosts: "6000",
    leads: 300,
    bookedCalls: 150,
    showedCalls: 120,
    qualifiedCalls: 90,
    sales: 36,
  };
}

test("Task 29 derives exact default assumptions from three consecutive Rolling 3 Month actuals", () => {
  const result = resolveRolling3TargetAssumptions([
    actualMonth("2026-03"),
    actualMonth("2026-01"),
    actualMonth("2026-02"),
  ]);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.deepEqual(result.assumptions.source, {
    kind: "rolling_3_months",
    months: ["2026-01", "2026-02", "2026-03"],
  });
  assert.deepEqual(result.assumptions.revenuePerNewCustomer, ratio(1000));
  assert.deepEqual(result.assumptions.monthlyFixedAcquisitionCosts, ratio(3000));
  assert.deepEqual(result.assumptions.monthlyFixedNonAcquisitionCosts, ratio(6000));
  assert.deepEqual(
    result.assumptions.variableNonMediaAcquisitionCostPerNewCustomer,
    ratio(100),
  );
  assert.deepEqual(result.assumptions.variableNonAcquisitionCostPerNewCustomer, ratio(200));
  assert.deepEqual(result.assumptions.assumedMediaCac, ratio(200));
  assert.deepEqual(result.assumptions.bookingRate, ratio(1, 2));
  assert.deepEqual(result.assumptions.showRate, ratio(4, 5));
  assert.deepEqual(result.assumptions.qualificationRate, ratio(3, 4));
  assert.deepEqual(result.assumptions.closeRate, ratio(2, 5));
  assert.deepEqual(result.assumptions.saleToNewCustomerRate, ratio(5, 6));
});

test("Task 29 revenue target reverse-engineers the full funnel and uses an explicit break-even sustainability guardrail", () => {
  const result = planTarget({ type: "revenue", amount: "50000" }, manualAssumptions());

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.deepEqual(result.profitConstraint, { kind: "break_even", amount: ratio(0) });
  assert.deepEqual(result.requiredRevenue, ratio(50000));
  assert.equal(result.requiredCustomers, 50);
  assert.equal(result.requiredSales, 60);
  assert.equal(result.requiredQualifiedCalls, 150);
  assert.equal(result.requiredShows, 200);
  assert.equal(result.requiredBookings, 250);
  assert.equal(result.requiredLeads, 500);
  assert.deepEqual(result.requiredAdSpend, ratio(10000));
  assert.deepEqual(result.projectedNetProfit, ratio(16000));
  assert.deepEqual(result.projectedMargin, ratio(8, 25));
  assert.deepEqual(result.maximumSustainableAcquisitionCac, {
    available: true,
    value: ratio(680),
  });
  assert.deepEqual(result.maximumMediaCac, { available: true, value: ratio(520) });
  assert.deepEqual(result.maximumCpl, { available: true, value: ratio(52) });
});

test("Task 29 net profit target solves the minimum customer count with exact fixed-cost economics", () => {
  const result = planTarget({ type: "net_profit", amount: "20000" }, manualAssumptions());

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.deepEqual(result.requiredRevenue, ratio(58000));
  assert.equal(result.requiredCustomers, 58);
  assert.equal(result.requiredSales, 70);
  assert.equal(result.requiredQualifiedCalls, 175);
  assert.equal(result.requiredShows, 234);
  assert.equal(result.requiredBookings, 293);
  assert.equal(result.requiredLeads, 586);
  assert.deepEqual(result.requiredAdSpend, ratio(11600));
  assert.deepEqual(result.projectedNetProfit, ratio(20000));
  assert.deepEqual(result.projectedMargin, ratio(10, 29));
  assert.deepEqual(result.maximumSustainableAcquisitionCac, {
    available: true,
    value: ratio(10200, 29),
  });
  assert.deepEqual(result.maximumMediaCac, { available: true, value: ratio(200) });
  assert.deepEqual(result.maximumCpl, {
    available: true,
    value: ratio(5800, 293),
  });
});

test("Task 29 margin target solves fixed-cost dilution instead of averaging historical margins", () => {
  const result = planTarget(
    { type: "net_profit_margin", margin: ratio(2, 5) },
    manualAssumptions(),
  );

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.deepEqual(result.requiredRevenue, ratio(90000));
  assert.equal(result.requiredCustomers, 90);
  assert.equal(result.requiredSales, 108);
  assert.equal(result.requiredQualifiedCalls, 270);
  assert.equal(result.requiredShows, 360);
  assert.equal(result.requiredBookings, 450);
  assert.equal(result.requiredLeads, 900);
  assert.deepEqual(result.requiredAdSpend, ratio(18000));
  assert.deepEqual(result.projectedNetProfit, ratio(36000));
  assert.deepEqual(result.projectedMargin, ratio(2, 5));
  assert.deepEqual(result.maximumSustainableAcquisitionCac, {
    available: true,
    value: ratio(1000, 3),
  });
  assert.deepEqual(result.maximumMediaCac, { available: true, value: ratio(200) });
  assert.deepEqual(result.maximumCpl, { available: true, value: ratio(20) });
});

test("Task 29 rounds each upstream funnel stage upward so the target is never under-planned", () => {
  const result = planTarget({ type: "net_profit", amount: "20500" }, manualAssumptions());

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.equal(result.requiredCustomers, 59);
  assert.equal(result.requiredSales, 71);
  assert.equal(result.requiredQualifiedCalls, 178);
  assert.equal(result.requiredShows, 238);
  assert.equal(result.requiredBookings, 298);
  assert.equal(result.requiredLeads, 596);
  assert.ok(result.projectedNetProfit.numerator !== "20500" || result.projectedNetProfit.denominator !== "1");
});

test("Task 29 fails closed when a target margin cannot be reached under the assumed variable economics", () => {
  const result = planTarget(
    { type: "net_profit_margin", margin: ratio(3, 5) },
    manualAssumptions(),
  );

  assert.deepEqual(result, {
    status: "unattainable",
    reason: "MARGIN_TARGET_UNATTAINABLE",
    goal: { type: "net_profit_margin", margin: ratio(3, 5) },
    assumptions: manualAssumptions(),
  });
});

test("Task 29 Rolling 3 Month defaults report insufficient data instead of inventing a conversion rate", () => {
  const january = actualMonth("2026-01");
  const february = actualMonth("2026-02");
  const march = actualMonth("2026-03");
  january.leads = 0;
  february.leads = 0;
  march.leads = 0;
  january.bookedCalls = 0;
  february.bookedCalls = 0;
  march.bookedCalls = 0;
  january.showedCalls = 0;
  february.showedCalls = 0;
  march.showedCalls = 0;
  january.qualifiedCalls = 0;
  february.qualifiedCalls = 0;
  march.qualifiedCalls = 0;
  january.sales = 0;
  february.sales = 0;
  march.sales = 0;
  january.newCustomers = 0;
  february.newCustomers = 0;
  march.newCustomers = 0;

  const result = resolveRolling3TargetAssumptions([january, february, march]);

  assert.equal(result.status, "insufficient");
  if (result.status !== "insufficient") return;
  assert.ok(result.blockers.some((blocker) => blocker.code === "NO_NEW_CUSTOMERS"));
  assert.ok(result.blockers.some((blocker) => blocker.code === "NO_LEADS"));
  assert.ok(result.blockers.some((blocker) => blocker.code === "NO_SALES"));
});

test("Task 29 rejects non-consecutive months rather than labelling them Rolling 3 Months", () => {
  assert.throws(
    () =>
      resolveRolling3TargetAssumptions([
        actualMonth("2026-01"),
        actualMonth("2026-03"),
        actualMonth("2026-04"),
      ]),
    /consecutive calendar months/,
  );
});
