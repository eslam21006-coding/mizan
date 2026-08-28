import assert from "node:assert/strict";
import test from "node:test";
import type { CalculatedMetric, ExactRatio } from "../../src/lib/business/calculations.ts";
import {
  buildCoachDashboardFeed,
  type CoachBusinessSnapshot,
  type CoachFinancialSnapshot,
  type CoachFunnelSnapshot,
} from "../../src/lib/business/coach-dashboard.ts";
import { calculateFunnelMetrics } from "../../src/lib/business/funnel-calculations.ts";

function money(value: string): CalculatedMetric<string> {
  return { available: true, value };
}

function ratio(numerator: string, denominator: string): CalculatedMetric<ExactRatio> {
  return { available: true, value: { numerator, denominator } };
}

function unavailableMoney(): CalculatedMetric<string> {
  return { available: false, reason: "INPUT_UNAVAILABLE" };
}

function unavailableRatio(): CalculatedMetric<ExactRatio> {
  return { available: false, reason: "INPUT_UNAVAILABLE" };
}

function financial(values: {
  netCash: string;
  profit: string;
  margin: [string, string];
  ultimateCac: [string, string];
}): CoachFinancialSnapshot {
  return {
    netCashCollected: money(values.netCash),
    realNetProfit: money(values.profit),
    realNetProfitMargin: ratio(...values.margin),
    ultimateCac: ratio(...values.ultimateCac),
  };
}

function incompleteFinancial(): CoachFinancialSnapshot {
  return {
    netCashCollected: unavailableMoney(),
    realNetProfit: unavailableMoney(),
    realNetProfitMargin: unavailableRatio(),
    ultimateCac: unavailableRatio(),
  };
}

function funnel(
  funnelId: string,
  funnelName: string,
  values: { booked: number; showed: number; qualified: number; sales: number },
): CoachFunnelSnapshot {
  const result = calculateFunnelMetrics({
    adSpend: "1000",
    leads: 200,
    bookedCalls: values.booked,
    showedCalls: values.showed,
    qualifiedCalls: values.qualified,
    sales: values.sales,
    newCustomers: 10,
    cashCollected: "5000",
    attributedRevenue: null,
  });
  return {
    funnelId,
    funnelName,
    showRate: result.showRate,
    closeRate: result.closeRate,
    showRateHealth: result.showRateHealth,
    closeRateHealth: result.closeRateHealth,
  };
}

function snapshot(
  id: string,
  overrides: Partial<CoachBusinessSnapshot> = {},
): CoachBusinessSnapshot {
  return {
    menteeUserId: `mentee-${id}`,
    menteeEmail: `${id}@example.test`,
    businessId: `business-${id}`,
    businessName: `بزنس ${id}`,
    currentMonth: "2026-08",
    previousMonth: "2026-07",
    currentFinancial: financial({
      netCash: "1000",
      profit: "200",
      margin: ["1", "5"],
      ultimateCac: ["100", "1"],
    }),
    previousFinancial: financial({
      netCash: "1000",
      profit: "200",
      margin: ["1", "5"],
      ultimateCac: ["100", "1"],
    }),
    currentFunnels: [],
    previousFunnels: [],
    ...overrides,
  };
}

test("Task 36 prioritizes unhealthy growth when revenue rises while real profit falls", () => {
  const feed = buildCoachDashboardFeed([
    snapshot("growth", {
      currentFinancial: financial({
        netCash: "1200",
        profit: "100",
        margin: ["1", "12"],
        ultimateCac: ["140", "1"],
      }),
      previousFinancial: financial({
        netCash: "1000",
        profit: "200",
        margin: ["1", "5"],
        ultimateCac: ["100", "1"],
      }),
    }),
  ]);

  assert.equal(feed.attention.length, 1);
  assert.equal(feed.attention[0]?.code, "UNHEALTHY_GROWTH");
  assert.equal(feed.improvements.length, 0);
});

test("Task 36 uses the locked strict Show Rate and Close Rate health boundaries", () => {
  const showAtBoundary = funnel("show", "فانل الحضور", {
    booked: 100,
    showed: 65,
    qualified: 100,
    sales: 21,
  });
  const closeAtBoundary = funnel("close", "فانل الإغلاق", {
    booked: 100,
    showed: 66,
    qualified: 100,
    sales: 20,
  });

  assert.equal(showAtBoundary.showRateHealth, "below_benchmark");
  assert.equal(showAtBoundary.closeRateHealth, "healthy");
  assert.equal(closeAtBoundary.showRateHealth, "healthy");
  assert.equal(closeAtBoundary.closeRateHealth, "below_benchmark");

  const showFeed = buildCoachDashboardFeed([
    snapshot("show", {
      currentFinancial: null,
      previousFinancial: null,
      currentFunnels: [showAtBoundary],
    }),
  ]);
  assert.equal(showFeed.attention[0]?.code, "SHOW_RATE_UNHEALTHY");

  const closeFeed = buildCoachDashboardFeed([
    snapshot("close", {
      currentFinancial: null,
      previousFinancial: null,
      currentFunnels: [closeAtBoundary],
    }),
  ]);
  assert.equal(closeFeed.attention[0]?.code, "CLOSE_RATE_UNHEALTHY");
});

test("Task 36 prioritizes profit improvement while preserving other exact improvements", () => {
  const feed = buildCoachDashboardFeed([
    snapshot("improve", {
      currentFinancial: financial({
        netCash: "1400",
        profit: "350",
        margin: ["1", "4"],
        ultimateCac: ["80", "1"],
      }),
      previousFinancial: financial({
        netCash: "1000",
        profit: "200",
        margin: ["1", "5"],
        ultimateCac: ["100", "1"],
      }),
    }),
  ]);

  assert.equal(feed.improvements.length, 1);
  assert.equal(feed.improvements[0]?.code, "PROFIT_IMPROVING");
  assert.equal(feed.attention.length, 0);
});

test("Task 36 reports Ultimate CAC improvement when it is the strongest supported improvement", () => {
  const feed = buildCoachDashboardFeed([
    snapshot("cac", {
      currentFinancial: financial({
        netCash: "1000",
        profit: "200",
        margin: ["1", "5"],
        ultimateCac: ["80", "1"],
      }),
      previousFinancial: financial({
        netCash: "1000",
        profit: "200",
        margin: ["1", "5"],
        ultimateCac: ["100", "1"],
      }),
    }),
  ]);

  assert.equal(feed.improvements[0]?.code, "ULTIMATE_CAC_IMPROVING");
});

test("Task 36 selects one strongest signal across attention and improvement sections", () => {
  const feed = buildCoachDashboardFeed([
    snapshot("mixed", {
      currentFinancial: financial({
        netCash: "1000",
        profit: "150",
        margin: ["1", "6"],
        ultimateCac: ["80", "1"],
      }),
      previousFinancial: financial({
        netCash: "1000",
        profit: "200",
        margin: ["1", "5"],
        ultimateCac: ["100", "1"],
      }),
    }),
  ]);

  assert.equal(feed.attention.length, 1);
  assert.equal(feed.attention[0]?.code, "PROFIT_FALLING");
  assert.equal(feed.improvements.length, 0);
});

test("Task 36 recognizes funnel improvement only from the same funnel identity", () => {
  const current = funnel("same", "فانل المبيعات", {
    booked: 100,
    showed: 75,
    qualified: 100,
    sales: 30,
  });
  const previous = funnel("same", "فانل المبيعات", {
    booked: 100,
    showed: 70,
    qualified: 100,
    sales: 25,
  });
  const unrelatedPrevious = funnel("other", "فانل آخر", {
    booked: 100,
    showed: 10,
    qualified: 100,
    sales: 5,
  });

  const matched = buildCoachDashboardFeed([
    snapshot("funnel", {
      currentFinancial: null,
      previousFinancial: null,
      currentFunnels: [current],
      previousFunnels: [previous],
    }),
  ]);
  assert.equal(matched.improvements[0]?.code, "FUNNEL_METRICS_IMPROVING");

  const unmatched = buildCoachDashboardFeed([
    snapshot("funnel-unmatched", {
      currentFinancial: null,
      previousFinancial: null,
      currentFunnels: [current],
      previousFunnels: [unrelatedPrevious],
    }),
  ]);
  assert.equal(unmatched.improvements.length, 0);
});

test("Task 36 skips unavailable month comparisons instead of inventing account conclusions", () => {
  const feed = buildCoachDashboardFeed([
    snapshot("missing", {
      currentFinancial: incompleteFinancial(),
      previousFinancial: incompleteFinancial(),
      currentFunnels: [],
      previousFunnels: [],
    }),
  ]);

  assert.deepEqual(feed.attention, []);
  assert.deepEqual(feed.improvements, []);
  assert.equal(feed.insufficientBusinesses, 1);
});

test("Task 36 does not call complete flat data insufficient just because it has no signal", () => {
  const feed = buildCoachDashboardFeed([snapshot("flat")]);

  assert.deepEqual(feed.attention, []);
  assert.deepEqual(feed.improvements, []);
  assert.equal(feed.evaluatedBusinesses, 1);
  assert.equal(feed.insufficientBusinesses, 0);
});

test("Task 36 emits at most one strongest signal per business and caps each section at six", () => {
  const snapshots = Array.from({ length: 8 }, (_, index) =>
    snapshot(String(index), {
      currentFinancial: financial({
        netCash: "1100",
        profit: "100",
        margin: ["1", "11"],
        ultimateCac: ["120", "1"],
      }),
      previousFinancial: financial({
        netCash: "1000",
        profit: "200",
        margin: ["1", "5"],
        ultimateCac: ["100", "1"],
      }),
    }),
  );

  const feed = buildCoachDashboardFeed(snapshots);
  assert.equal(feed.attention.length, 6);
  assert.ok(feed.attention.every((signal) => signal.code === "UNHEALTHY_GROWTH"));
  assert.equal(new Set(feed.attention.map((signal) => signal.businessId)).size, 6);
  assert.deepEqual(
    feed.attention.map((signal) => signal.menteeEmail),
    ["0@example.test", "1@example.test", "2@example.test", "3@example.test", "4@example.test", "5@example.test"],
  );
});
