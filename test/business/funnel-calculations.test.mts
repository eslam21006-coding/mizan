import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  calculateFunnelMetrics,
  reconcileBusinessAdSpend,
} from "../../src/lib/business/funnel-calculations.ts";
import { safeReconcileBusinessAdSpend } from "../../src/lib/business/funnel-month.ts";
import {
  parseOptionalDecimalInput,
  parseOptionalSignedDecimalInput,
} from "../../src/lib/business/monthly.ts";

const dashboardMonthSource = await readFile(
  new URL("../../src/lib/business/dashboard-month.ts", import.meta.url),
  "utf8",
);
const funnelMonthlyPageSource = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/funnels/monthly/page.tsx",
    import.meta.url,
  ),
  "utf8",
);

function availableRatio(metric: { available: boolean; value?: { numerator: string; denominator: string } }) {
  assert.equal(metric.available, true);
  if (!metric.available || !metric.value) throw new Error("Expected available ratio.");
  return metric.value;
}

test("funnel formulas use exact known inputs", () => {
  const result = calculateFunnelMetrics({
    adSpend: "1000",
    leads: 100,
    bookedCalls: 20,
    showedCalls: 15,
    qualifiedCalls: 10,
    sales: 3,
    newCustomers: 4,
    cashCollected: "3000",
    attributedRevenue: "2000",
  });

  assert.deepEqual(availableRatio(result.cpl), { numerator: "10", denominator: "1" });
  assert.deepEqual(availableRatio(result.costPerBooking), { numerator: "50", denominator: "1" });
  assert.deepEqual(availableRatio(result.costPerShow), { numerator: "200", denominator: "3" });
  assert.deepEqual(availableRatio(result.costPerQualifiedCall), {
    numerator: "100",
    denominator: "1",
  });
  assert.deepEqual(availableRatio(result.showRate), { numerator: "15", denominator: "20" });
  assert.deepEqual(availableRatio(result.qualificationRate), {
    numerator: "10",
    denominator: "15",
  });
  assert.deepEqual(availableRatio(result.closeRate), { numerator: "3", denominator: "10" });
  assert.deepEqual(availableRatio(result.leadToSaleRate), { numerator: "3", denominator: "100" });
  assert.deepEqual(availableRatio(result.mediaCac), { numerator: "250", denominator: "1" });
  assert.deepEqual(availableRatio(result.roas), { numerator: "2", denominator: "1" });
  assert.equal(result.showRateHealth, "healthy");
  assert.equal(result.closeRateHealth, "healthy");
});

test("Show Rate and Close Rate benchmarks are strict greater-than thresholds", () => {
  const exactThresholds = calculateFunnelMetrics({
    adSpend: "100",
    leads: 100,
    bookedCalls: 20,
    showedCalls: 13,
    qualifiedCalls: 10,
    sales: 2,
    newCustomers: 2,
    cashCollected: "0",
    attributedRevenue: "100",
  });

  assert.deepEqual(availableRatio(exactThresholds.showRate), {
    numerator: "13",
    denominator: "20",
  });
  assert.deepEqual(availableRatio(exactThresholds.closeRate), {
    numerator: "2",
    denominator: "10",
  });
  assert.equal(exactThresholds.showRateHealth, "below_benchmark");
  assert.equal(exactThresholds.closeRateHealth, "below_benchmark");

  const aboveThresholds = calculateFunnelMetrics({
    adSpend: "100",
    leads: 100,
    bookedCalls: 100,
    showedCalls: 66,
    qualifiedCalls: 100,
    sales: 21,
    newCustomers: 21,
    cashCollected: "0",
    attributedRevenue: "100",
  });

  assert.equal(aboveThresholds.showRateHealth, "healthy");
  assert.equal(aboveThresholds.closeRateHealth, "healthy");
});

test("zero funnel denominators return metric-specific unavailable reasons", () => {
  const result = calculateFunnelMetrics({
    adSpend: "100",
    leads: 0,
    bookedCalls: 0,
    showedCalls: 0,
    qualifiedCalls: 0,
    sales: 0,
    newCustomers: 0,
    cashCollected: "0",
    attributedRevenue: "0",
  });

  assert.deepEqual(result.cpl, { available: false, reason: "NO_LEADS" });
  assert.deepEqual(result.costPerBooking, { available: false, reason: "NO_BOOKED_CALLS" });
  assert.deepEqual(result.costPerShow, { available: false, reason: "NO_SHOWED_CALLS" });
  assert.deepEqual(result.costPerQualifiedCall, {
    available: false,
    reason: "NO_QUALIFIED_CALLS",
  });
  assert.deepEqual(result.showRate, { available: false, reason: "NO_BOOKED_CALLS" });
  assert.deepEqual(result.qualificationRate, { available: false, reason: "NO_SHOWED_CALLS" });
  assert.deepEqual(result.closeRate, { available: false, reason: "NO_QUALIFIED_CALLS" });
  assert.deepEqual(result.leadToSaleRate, { available: false, reason: "NO_LEADS" });
  assert.deepEqual(result.mediaCac, { available: false, reason: "NO_NEW_CUSTOMERS" });
});

test("ROAS never substitutes Cash Collected for missing attribution", () => {
  const result = calculateFunnelMetrics({
    adSpend: "1000",
    leads: 10,
    bookedCalls: 5,
    showedCalls: 5,
    qualifiedCalls: 5,
    sales: 2,
    newCustomers: 2,
    cashCollected: "5000",
    attributedRevenue: null,
  });

  assert.deepEqual(result.roas, { available: false, reason: "ATTRIBUTION_UNAVAILABLE" });
});

test("ROAS accepts negative attributed revenue after attributable refunds", () => {
  const result = calculateFunnelMetrics({
    adSpend: "1000",
    leads: 10,
    bookedCalls: 5,
    showedCalls: 5,
    qualifiedCalls: 5,
    sales: 2,
    newCustomers: 2,
    cashCollected: "5000",
    attributedRevenue: "-500",
  });

  assert.deepEqual(availableRatio(result.roas), { numerator: "-1", denominator: "2" });
});

test("ROAS keeps attribution-unavailable precedence and detects zero ad spend when attribution exists", () => {
  const missingAttribution = calculateFunnelMetrics({
    adSpend: "0",
    leads: 1,
    bookedCalls: 1,
    showedCalls: 1,
    qualifiedCalls: 1,
    sales: 1,
    newCustomers: 1,
    cashCollected: "10",
    attributedRevenue: null,
  });
  assert.deepEqual(missingAttribution.roas, {
    available: false,
    reason: "ATTRIBUTION_UNAVAILABLE",
  });

  const knownAttribution = calculateFunnelMetrics({
    adSpend: "0",
    leads: 1,
    bookedCalls: 1,
    showedCalls: 1,
    qualifiedCalls: 1,
    sales: 1,
    newCustomers: 1,
    cashCollected: "10",
    attributedRevenue: "10",
  });
  assert.deepEqual(knownAttribution.roas, { available: false, reason: "NO_AD_SPEND" });
});

test("ad-spend reconciliation never adds business and funnel totals together", () => {
  const matched = reconcileBusinessAdSpend("1000", ["600", "400"]);
  assert.equal(matched.status, "matched");
  assert.deepEqual(matched.canonicalAdSpend, { available: true, value: "1000" });
  assert.deepEqual(matched.funnelAdSpendTotal, { available: true, value: "1000" });
  assert.deepEqual(matched.difference, { available: true, value: "0" });

  const mismatch = reconcileBusinessAdSpend("1200", ["600", "400"]);
  assert.equal(mismatch.status, "mismatch");
  assert.deepEqual(mismatch.canonicalAdSpend, { available: true, value: "1200" });
  assert.deepEqual(mismatch.funnelAdSpendTotal, { available: true, value: "1000" });
  assert.deepEqual(mismatch.difference, { available: true, value: "200" });
});

test("complete funnel spend can roll up only when business Total Ad Spend is missing", () => {
  const funnelOnly = reconcileBusinessAdSpend(null, ["600", "400"]);
  assert.equal(funnelOnly.status, "funnel_only");
  assert.deepEqual(funnelOnly.canonicalAdSpend, { available: true, value: "1000" });

  const incomplete = reconcileBusinessAdSpend(null, ["600", null]);
  assert.equal(incomplete.status, "incomplete");
  assert.deepEqual(incomplete.canonicalAdSpend, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });

  const businessOnly = reconcileBusinessAdSpend("1200", ["600", null]);
  assert.equal(businessOnly.status, "business_only");
  assert.deepEqual(businessOnly.canonicalAdSpend, { available: true, value: "1200" });

  const noData = reconcileBusinessAdSpend(null, []);
  assert.equal(noData.status, "incomplete");
  assert.deepEqual(noData.canonicalAdSpend, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });
});

test("malformed stored ad spend fails reconciliation closed without throwing", () => {
  const malformedBusiness = safeReconcileBusinessAdSpend("1e+21", ["100"]);
  assert.equal(malformedBusiness.reconciliationError, true);
  assert.deepEqual(malformedBusiness.reconciliation.canonicalAdSpend, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });

  const malformedFunnel = safeReconcileBusinessAdSpend("100", ["-1"]);
  assert.equal(malformedFunnel.reconciliationError, true);
  assert.deepEqual(malformedFunnel.reconciliation.canonicalAdSpend, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });

  const valid = safeReconcileBusinessAdSpend("100", ["100"]);
  assert.equal(valid.reconciliationError, false);
  assert.equal(valid.reconciliation.status, "matched");
});

test("optional funnel failures cannot suppress otherwise valid core dashboard metrics", () => {
  assert.match(dashboardMonthSource, /if \(revenueResult\.error \|\| expenseResult\.error\)/);
  assert.doesNotMatch(
    dashboardMonthSource,
    /revenueResult\.error \|\| expenseResult\.error \|\| funnelMonth\.dataLoadError/,
  );
  assert.match(dashboardMonthSource, /!funnelMonth\.reconciliationError/);
});

test("funnel monthly errors are assertive and every repeated metric input has a unique accessible name", () => {
  assert.match(funnelMonthlyPageSource, /role=\{statusError \? "alert" : "status"\}/);

  for (const label of [
    "Ad Spend",
    "Leads",
    "Booked Calls",
    "Showed Calls",
    "Qualified Calls",
    "Sales",
    "New Customers",
    "Cash Collected",
    "Attributed Revenue",
  ]) {
    assert.ok(
      funnelMonthlyPageSource.includes('aria-label={`' + label + ' — ${displayName}`}'),
      `Missing unique accessible label for ${label}`,
    );
  }
});

test("signed localized money parsing is limited to attributed-revenue-style inputs", () => {
  assert.deepEqual(parseOptionalSignedDecimalInput("-١٬٢٣٤٫٥٠"), {
    ok: true,
    value: "-1234.5",
  });
  assert.deepEqual(parseOptionalSignedDecimalInput("-٠"), { ok: true, value: "0" });
  assert.deepEqual(parseOptionalDecimalInput("-١٠"), { ok: false, value: null });
});
