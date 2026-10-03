import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateCoreFinancials } from "../../src/lib/business/calculations.ts";
import { resolveBusinessSetupReadiness } from "../../src/lib/business/setup-readiness.ts";
import {
  resolvePayoffMonthGate,
  resolveSetupPayoffResult,
} from "../../src/lib/business/setup-payoff-result.ts";

const now = new Date("2026-10-03T10:00:00.000Z");
const business = { id: "b11a", name: "Demo", baseCurrency: "USD", timezone: "Africa/Cairo" };
const persistedMonths = {
  savedMonthKeys: ["2026-09", "2026-08"],
  completedMonthKeys: ["2026-08"],
  validMonthCount: 1,
  latestSavedMonthKey: "2026-09",
  latestCompleteMonthKey: "2026-08",
};
function setup(expenseReviewed = true, saved = persistedMonths) {
  return {
    kind: "loaded" as const,
    business,
    canManage: false, // RLS-authorized read-only members must still see their results.
    revenueSources: [],
    revenueSourceCount: 1,
    expenseItems: [],
    activeExpenseCategoryCounts: { acquisition: 0, fulfillment: 0, overhead: 0, financial: 0 },
    latestSavedMonthKey: saved.latestSavedMonthKey,
    persistedMonths: saved,
    readiness: resolveBusinessSetupReadiness({
      loadState: "loaded",
      revenueSourceCount: 1,
      expenseSetupReviewedAt: expenseReviewed ? "2026-09-28T00:00:00Z" : null,
      validMonthCount: saved.validMonthCount,
    }),
  };
}
function financials(newCustomers = 11, gross = "12000", refunds = "2000") {
  return calculateCoreFinancials({
    revenueStreams: [
      { id: "a", name: "Agency", streamType: "front_end",
        grossCashCollected: gross, refunds },
    ],
    expenses: [
      { id: "ads", name: "Ads", category: "acquisition", behavior: "fixed_monthly", inputValue: "2500" },
      { id: "delivery", name: "Delivery", category: "fulfillment", behavior: "fixed_monthly", inputValue: "1000" },
      { id: "rent", name: "Rent", category: "overhead", behavior: "fixed_monthly", inputValue: "1500" },
      { id: "fees", name: "Fees", category: "financial", behavior: "fixed_monthly", inputValue: "500" },
    ],
    unallocatedGrossCashCollected: null, unallocatedRefunds: null,
    newCustomers, totalPayingCustomers: newCustomers,
    canonicalAdSpend: null,
  });
}
const canonical = financials();
const month = (overrides = {}) => ({
  periodExists: true, result: canonical, calculationInput: null,
  dataLoadError: false, calculationError: false, ...overrides,
});
function deps(loadedSetup = setup(), loadedMonth = month()) {
  let calls = 0;
  return {
    loadSetup: async () => loadedSetup,
    loadMonth: async () => { calls++; return loadedMonth; },
    get monthReads() { return calls; },
  };
}

test("B11.2 shows the requested complete August from saved actuals, never partial September", async () => {
  const dependencies = deps();
  const incomplete = await resolveSetupPayoffResult("b11a", "2026-09", dependencies, now);
  assert.deepEqual(incomplete, {
    kind: "month_incomplete", business, monthKey: "2026-09",
  });
  assert.equal(dependencies.monthReads, 0);
  const ready = await resolveSetupPayoffResult("b11a", "2026-08", dependencies, now);
  assert.equal(ready.kind, "ready");
  assert.equal(dependencies.monthReads, 1);
  if (ready.kind === "ready") {
    assert.equal(ready.monthKey, "2026-08");
    assert.deepEqual(ready.financials.netCashCollected, { available: true, value: "10000" });
    assert.deepEqual(ready.financials.realNetProfit, { available: true, value: "4500" });
    assert.deepEqual(ready.financials.realNetProfitMargin, {
      available: true, value: { numerator: "9", denominator: "20" },
    });
    assert.deepEqual(ready.financials.ultimateCac, {
      available: true, value: { numerator: "500", denominator: "1" },
    });
  }
});

test("B11.2 rejects missing, malformed, duplicated, unsaved and future months without a calculation", async () => {
  const cases = [
    [undefined, "missing_month", null],
    [["2026-08", "2026-09"], "invalid_month", null],
    ["2026-13", "invalid_month", null],
    ["2026-07", "not_saved", "2026-07"],
    ["2026-11", "future_month", "2026-11"],
  ] as const;
  for (const [requested, kind, monthKey] of cases) {
    const dependencies = deps();
    const result = await resolveSetupPayoffResult("b11a", requested, dependencies, now);
    assert.equal(result.kind, kind);
    if (result.kind !== "ready" && result.kind !== "not_found") {
      assert.equal(result.monthKey, monthKey);
    }
    assert.equal(dependencies.monthReads, 0);
  }
  assert.deepEqual(resolvePayoffMonthGate(setup(), "2026-08", now), {
    kind: "ready", monthKey: "2026-08",
  });
});

test("B11.2 future-month validation respects the business timezone", () => {
  const earlyOctoberInCairo = new Date("2026-09-30T22:30:00Z");
  const october = {
    ...persistedMonths,
    savedMonthKeys: ["2026-10", "2026-09", "2026-08"],
    completedMonthKeys: ["2026-10", "2026-08"],
    validMonthCount: 2,
    latestCompleteMonthKey: "2026-10",
  };
  assert.deepEqual(resolvePayoffMonthGate(setup(true, october), "2026-10", earlyOctoberInCairo), {
    kind: "ready", monthKey: "2026-10",
  });
  assert.deepEqual(resolvePayoffMonthGate(setup(true, october), "2026-10", new Date("2026-09-30T18:00:00Z")), {
    kind: "future_month", monthKey: "2026-10",
  });
});

test("B11.2 global setup readiness cannot be bypassed by a complete month", async () => {
  const dependencies = deps(setup(false));
  const result = await resolveSetupPayoffResult("b11a", "2026-08", dependencies, now);
  assert.equal(result.kind, "setup_incomplete");
  assert.equal(dependencies.monthReads, 0);
});

test("B11.2 not-found prevents cross-business disclosures and failed setup loads fail closed", async () => {
  let calls = 0;
  const missing = await resolveSetupPayoffResult("other-business", "2026-08", {
    loadSetup: async () => ({ kind: "not_found" }),
    loadMonth: async () => { calls++; return month(); },
  }, now);
  assert.deepEqual(missing, { kind: "not_found" });
  assert.equal(calls, 0);
  const error = await resolveSetupPayoffResult("unknown", "2026-08", {
    loadSetup: async () => { throw new Error("private database details"); },
    loadMonth: async () => { throw new Error("must not load"); },
  }, now);
  assert.deepEqual(error, { kind: "data_load_error", business: null, monthKey: null });
  const setupReadError = await resolveSetupPayoffResult("b11a", "2026-08", {
    loadSetup: async () => ({
      kind: "load_error", business, canManage: false, readiness: setup().readiness,
    }),
    loadMonth: async () => { throw new Error("must not load"); },
  }, now);
  assert.deepEqual(setupReadError, { kind: "data_load_error", business, monthKey: null });
});

test("B11.2 canonical data and calculation failures never show a success result", async () => {
  for (const [loaded, kind] of [
    [month({ periodExists: false }), "not_saved"],
    [month({ dataLoadError: true }), "data_load_error"],
    [month({ calculationError: true }), "calculation_error"],
    [month({ result: null }), "calculation_error"],
    [month({ result: { ...canonical, realNetProfit: { available: false, reason: "INPUT_UNAVAILABLE" } } }), "calculation_error"],
    [month({ result: { ...canonical, ultimateCac: { available: false, reason: "INPUT_UNAVAILABLE" } } }), "calculation_error"],
  ] as const) {
    const result = await resolveSetupPayoffResult("b11a", "2026-08", deps(setup(), loaded), now);
    assert.equal(result.kind, kind);
  }
  const thrown = await resolveSetupPayoffResult("b11a", "2026-08", {
    loadSetup: async () => setup(),
    loadMonth: async () => { throw new Error("private canonical data load failed"); },
  }, now);
  assert.deepEqual(thrown, { kind: "data_load_error", business, monthKey: "2026-08" });
});

test("B11.2 legitimate zero denominator metrics stay unavailable without blocking a valid result", async () => {
  const zero = financials(0, "0", "0");
  assert.deepEqual(zero.realNetProfit, { available: true, value: "-5500" });
  const loaded = await resolveSetupPayoffResult("b11a", "2026-08", deps(setup(), month({ result: zero })), now);
  assert.equal(loaded.kind, "ready");
  if (loaded.kind === "ready") {
    assert.deepEqual(loaded.financials.ultimateCac, { available: false, reason: "NO_NEW_CUSTOMERS" });
    assert.deepEqual(loaded.financials.realNetProfitMargin, { available: false, reason: "NON_POSITIVE_NET_CASH" });
  }
});

test("B11.2 real server adapter authenticates first and always reads canonical data under RLS", () => {
  const route = readFileSync("src/app/(app)/businesses/[businessId]/setup/result/page.tsx", "utf8");
  const server = readFileSync("src/lib/business/setup-payoff-server.ts", "utf8");
  assert.match(route, /parseResourceId\(rawBusinessId\)/);
  assert.match(route, /notFound\(\)/);
  assert.match(route, /dynamic = "force-dynamic"/);
  assert.match(route, /loadAuthenticatedSetupPayoff\(businessId, query\.month\)/);
  assert.match(server, /await requireAuthContext\(\)/);
  assert.match(server, /loadSetup: loadBusinessSetup/);
  assert.match(server, /loadDashboardMonth\(/);
  assert.doesNotMatch(route + server, /\.rpc\(|\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
});
