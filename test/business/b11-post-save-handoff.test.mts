import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateCoreFinancials } from "../../src/lib/business/calculations.ts";
import {
  parseFirstMonthPostSaveStatus,
  resolveFirstMonthPostSaveDestination,
} from "../../src/lib/business/first-month-post-save.ts";
import { resolveSetupPayoffResult } from "../../src/lib/business/setup-payoff-result.ts";
import { resolveBusinessSetupReadiness } from "../../src/lib/business/setup-readiness.ts";

const businessId = "00000000-0000-4000-8000-000000000146";
const business = { id: businessId, name: "Course Agency", baseCurrency: "USD", timezone: "Africa/Cairo" };
const monthHref = (month: string, status: string) =>
  `/businesses/${businessId}/setup?step=month&month=${month}&status=${status}`;
const payoffHref = (month: string) => `/businesses/${businessId}/setup/result?month=${month}`;
const now = new Date("2026-10-03T10:00:00Z");
const verifiedFinancials = calculateCoreFinancials({
  revenueStreams: [{
    id: "agency", name: "Agency", streamType: "front_end",
    grossCashCollected: "12000", refunds: "2000",
  }],
  expenses: [
    { id: "ads", name: "Ads", category: "acquisition", behavior: "fixed_monthly", inputValue: "2500" },
    { id: "delivery", name: "Delivery", category: "fulfillment", behavior: "fixed_monthly", inputValue: "1000" },
    { id: "rent", name: "Rent", category: "overhead", behavior: "fixed_monthly", inputValue: "1500" },
    { id: "fees", name: "Fees", category: "financial", behavior: "fixed_monthly", inputValue: "500" },
  ],
  unallocatedGrossCashCollected: "0",
  unallocatedRefunds: "0",
  newCustomers: 11,
  totalPayingCustomers: 11,
});
function persistedSetup(completeMonths: string[], expenseReviewed = true) {
  return {
    kind: "loaded" as const,
    business,
    canManage: true,
    revenueSources: [],
    revenueSourceCount: 1,
    expenseItems: [],
    activeExpenseCategoryCounts: { acquisition: 1, fulfillment: 1, overhead: 1, financial: 1 },
    latestSavedMonthKey: "2026-09",
    persistedMonths: {
      savedMonthKeys: ["2026-09", "2026-08"],
      completedMonthKeys: completeMonths,
      latestSavedMonthKey: "2026-09",
      latestCompleteMonthKey: completeMonths[0] ?? null,
      validMonthCount: completeMonths.length,
    },
    readiness: resolveBusinessSetupReadiness({
      loadState: "loaded",
      revenueSourceCount: 1,
      expenseSetupReviewedAt: expenseReviewed ? "2026-08-01T00:00:00Z" : null,
      validMonthCount: completeMonths.length,
    }),
  };
}

test("B11.4 successful save opens only the reloaded exact month's verified result", async () => {
  let requestedPeriod: string | null = null;
  const verified = await resolveSetupPayoffResult(businessId, "2026-09", {
    loadSetup: async () => persistedSetup(["2026-09", "2026-08"]),
    loadMonth: async (_, period) => {
      requestedPeriod = period;
      return { periodExists: true, result: verifiedFinancials, calculationInput: null, calculationError: false, dataLoadError: false };
    },
  }, now);
  assert.equal(verified.kind, "ready");
  assert.equal(requestedPeriod, "2026-09-01");
  assert.deepEqual(verifiedFinancials.netCashCollected, { available: true, value: "10000" });
  assert.deepEqual(verifiedFinancials.realNetProfit, { available: true, value: "4500" });
  assert.equal(resolveFirstMonthPostSaveDestination(businessId, "2026-09", verified), payoffHref("2026-09"));
});

test("B11.4 partial September never redirects to a complete August result", async () => {
  let monthReads = 0;
  const verified = await resolveSetupPayoffResult(businessId, "2026-09", {
    loadSetup: async () => persistedSetup(["2026-08"]),
    loadMonth: async () => {
      monthReads++;
      throw new Error("Must never calculate a different saved month");
    },
  }, now);
  assert.equal(verified.kind, "month_incomplete");
  assert.equal(monthReads, 0);
  assert.equal(resolveFirstMonthPostSaveDestination(businessId, "2026-09", verified),
    monthHref("2026-09", "saved"));
});

test("B11.4 a complete month with unfinished other setup remains on exact Step 4", async () => {
  let monthReads = 0;
  const verified = await resolveSetupPayoffResult(businessId, "2026-09", {
    loadSetup: async () => persistedSetup(["2026-09"], false),
    loadMonth: async () => {
      monthReads++;
      throw new Error("Premature calculation when setup incomplete");
    },
  }, now);
  assert.equal(verified.kind, "setup_incomplete");
  assert.equal(monthReads, 0);
  assert.equal(resolveFirstMonthPostSaveDestination(businessId, "2026-09", verified),
    monthHref("2026-09", "setup-incomplete"));
});

test("B11.4 calculation and read failures do not fake a result or discard successful writes", async () => {
  const cases = [
    ["calculation_error", "result-unavailable"],
    ["data_load_error", "verification-unavailable"],
    ["not_saved", "verification-unavailable"],
    ["future_month", "verification-unavailable"],
  ] as const;
  for (const [kind, status] of cases) {
    assert.equal(
      resolveFirstMonthPostSaveDestination(businessId, "2026-09", {
        kind, business, monthKey: "2026-09",
      }),
      monthHref("2026-09", status),
      kind,
    );
  }
  const missingUnallocated = calculateCoreFinancials({
    revenueStreams: [{ id: "a", name: "Agency", streamType: "front_end", grossCashCollected: "100", refunds: "0" }],
    expenses: [],
    unallocatedGrossCashCollected: null,
    unallocatedRefunds: null,
    newCustomers: 1, totalPayingCustomers: 1,
  });
  const verified = await resolveSetupPayoffResult(businessId, "2026-09", {
    loadSetup: async () => persistedSetup(["2026-09"]),
    loadMonth: async () => ({
      periodExists: true, result: missingUnallocated, calculationInput: null,
      dataLoadError: false, calculationError: false,
    }),
  }, now);
  assert.equal(verified.kind, "calculation_error");
  assert.equal(resolveFirstMonthPostSaveDestination(businessId, "2026-09", verified),
    monthHref("2026-09", "result-unavailable"));
});

test("B11.4 a re-read of the wrong business or month cannot produce a result redirect", () => {
  assert.equal(
    resolveFirstMonthPostSaveDestination(businessId, "2026-09", {
      kind: "ready", business, monthKey: "2026-08", financials: verifiedFinancials,
    }),
    monthHref("2026-09", "verification-unavailable"),
  );
  assert.equal(
    resolveFirstMonthPostSaveDestination(businessId, "2026-09", {
      kind: "ready", business: { ...business, id: "foreign" }, monthKey: "2026-09", financials: verifiedFinancials,
    }),
    monthHref("2026-09", "verification-unavailable"),
  );
  assert.equal(resolveFirstMonthPostSaveDestination(businessId, "2026-09", { kind: "not_found" }),
    "/businesses");
});

test("B11.4 whitelists only recognized saved feedback states", () => {
  for (const status of ["saved", "setup-incomplete", "result-unavailable", "verification-unavailable"]) {
    assert.equal(parseFirstMonthPostSaveStatus(status), status);
  }
  for (const status of [undefined, "", "ready", "unsaved", ["saved"], "saved&redirect=evil"]) {
    assert.equal(parseFirstMonthPostSaveStatus(status), null);
  }
});

test("B11.4 only successful Setup writes perform authorized re-read; normal Monthly behavior is untouched", () => {
  const setupAction = readFileSync(
    "src/app/(app)/businesses/[businessId]/setup/first-month-actions.ts", "utf8",
  );
  const monthlyActions = readFileSync(
    "src/app/(app)/businesses/[businessId]/monthly/actions.ts", "utf8",
  );
  const save = setupAction.indexOf("await persistMonthlyActuals(formData, { setupDraft: true })");
  const reject = setupAction.indexOf("if (!result.ok)");
  const read = setupAction.indexOf("await loadAuthenticatedSetupPayoff(businessId, result.monthKey)");
  const handoff = setupAction.indexOf("redirect(resolveFirstMonthPostSaveDestination(");
  assert.ok(save >= 0 && reject > save && read > reject && handoff > read);
  assert.match(setupAction, /preserveDraft\(formData\)/);
  assert.match(setupAction, /revalidatePath\(\`\/businesses\/\$\{businessId\}\/setup\/result\`\)/);
  assert.match(monthlyActions, /redirectMonthly\(result\.businessId, result\.monthKey, "saved", returnOrigin\)/);
  assert.doesNotMatch(monthlyActions, /loadAuthenticatedSetupPayoff|resolveFirstMonthPostSaveDestination/);
});
