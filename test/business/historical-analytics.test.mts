import assert from "node:assert/strict";
import test from "node:test";
import { calculateCoreFinancials } from "../../src/lib/business/calculations.ts";
import { aggregateHistoricalMonths } from "../../src/lib/business/historical-aggregation.ts";
import { resolveHistoricalPeriod } from "../../src/lib/business/historical-period.ts";

function month({
  gross,
  refunds,
  newCustomers,
  payingCustomers,
  financialPercent,
}: {
  gross: string | null;
  refunds: string | null;
  newCustomers: number | null;
  payingCustomers: number | null;
  financialPercent: string | null;
}) {
  return calculateCoreFinancials({
    revenueStreams: [],
    expenses: [
      {
        id: "processor",
        name: "Processor",
        category: "financial",
        behavior: "percentage_revenue",
        inputValue: financialPercent,
      },
    ],
    unallocatedGrossCashCollected: gross,
    unallocatedRefunds: refunds,
    newCustomers,
    totalPayingCustomers: payingCustomers,
    canonicalAdSpend: null,
    attributedRevenue: null,
  });
}

test("resolves Rolling 3 Months, YTD, and full-month custom ranges", () => {
  assert.deepEqual(resolveHistoricalPeriod("rolling3", "2026-04"), {
    ok: true,
    mode: "rolling3",
    startMonthKey: "2026-02",
    endMonthKey: "2026-04",
    monthKeys: ["2026-02", "2026-03", "2026-04"],
  });

  assert.deepEqual(resolveHistoricalPeriod("ytd", "2026-04"), {
    ok: true,
    mode: "ytd",
    startMonthKey: "2026-01",
    endMonthKey: "2026-04",
    monthKeys: ["2026-01", "2026-02", "2026-03", "2026-04"],
  });

  assert.deepEqual(resolveHistoricalPeriod("custom", "2026-04", "2026-02", "2026-04"), {
    ok: true,
    mode: "custom",
    startMonthKey: "2026-02",
    endMonthKey: "2026-04",
    monthKeys: ["2026-02", "2026-03", "2026-04"],
  });
});

test("fails closed for reversed custom ranges and unsupported Rolling 3 boundary", () => {
  assert.deepEqual(resolveHistoricalPeriod("custom", "2026-04", "2026-05", "2026-04"), {
    ok: false,
    reason: "INVALID_CUSTOM_RANGE",
  });
  assert.deepEqual(resolveHistoricalPeriod("rolling3", "2000-01"), {
    ok: false,
    reason: "UNSUPPORTED_BOUNDARY",
  });
});

test("sums monthly additive results and recomputes margins from combined totals", () => {
  const positiveMonth = month({
    gross: "100",
    refunds: "0",
    newCustomers: 5,
    payingCustomers: 5,
    financialPercent: "0.1",
  });
  const refundHeavyMonth = month({
    gross: "0",
    refunds: "50",
    newCustomers: 0,
    payingCustomers: 0,
    financialPercent: "0.1",
  });

  const aggregate = aggregateHistoricalMonths([positiveMonth, refundHeavyMonth]);

  assert.deepEqual(aggregate.grossCashCollected, { available: true, value: "100" });
  assert.deepEqual(aggregate.refunds, { available: true, value: "50" });
  assert.deepEqual(aggregate.netCashCollected, { available: true, value: "50" });
  assert.deepEqual(aggregate.expensesByCategory.financial, { available: true, value: "10" });
  assert.deepEqual(aggregate.allBusinessCosts, { available: true, value: "10" });
  assert.deepEqual(aggregate.variableCosts, { available: true, value: "10" });
  assert.deepEqual(aggregate.realNetProfit, { available: true, value: "40" });
  assert.deepEqual(aggregate.realNetProfitMargin, {
    available: true,
    value: { numerator: "4", denominator: "5" },
  });
  assert.deepEqual(aggregate.contributionProfit, { available: true, value: "40" });
  assert.deepEqual(aggregate.contributionMargin, {
    available: true,
    value: { numerator: "4", denominator: "5" },
  });

  // The 10% expense is 10 in the positive month and 0 in the refund-heavy month.
  // Reapplying 10% to combined Net Cash (50) would incorrectly produce 5.
  assert.notDeepEqual(aggregate.expensesByCategory.financial, { available: true, value: "5" });
});

test("labels manual multi-month customer counts as monthly sums rather than exact unique customers", () => {
  const first = month({
    gross: "100",
    refunds: "0",
    newCustomers: 5,
    payingCustomers: 8,
    financialPercent: "0",
  });
  const second = month({
    gross: "120",
    refunds: "0",
    newCustomers: 4,
    payingCustomers: 9,
    financialPercent: "0",
  });
  const aggregate = aggregateHistoricalMonths([first, second]);

  assert.deepEqual(aggregate.reportedNewCustomersSum, { available: true, value: 9 });
  assert.deepEqual(aggregate.reportedPayingCustomersSum, { available: true, value: 17 });
  assert.equal(aggregate.exactUniqueCustomerMetricsAvailable, false);
});

test("propagates unavailable additive data instead of coercing it to zero", () => {
  const complete = month({
    gross: "100",
    refunds: "0",
    newCustomers: 5,
    payingCustomers: 5,
    financialPercent: "0",
  });
  const incomplete = month({
    gross: null,
    refunds: "0",
    newCustomers: 0,
    payingCustomers: 0,
    financialPercent: "0",
  });
  const aggregate = aggregateHistoricalMonths([complete, incomplete]);

  assert.deepEqual(aggregate.netCashCollected, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(aggregate.realNetProfitMargin, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });
});
