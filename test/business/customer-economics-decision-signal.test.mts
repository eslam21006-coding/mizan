import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomerEconomicsDecisionSignal,
  customerEconomicsDecisionQualitySignal,
  type CustomerEconomicsDecisionRow,
} from "../../src/lib/business/customer-economics-decision-signal.ts";

function row(
  cohortMonth: string,
  profit: string | null,
  quality: "actual" | "estimated" | "incomplete",
  currency = "USD",
): CustomerEconomicsDecisionRow {
  return {
    cohort_month: cohortMonth,
    lifetime_contribution_profit_text: profit,
    quality_state: quality,
    currency,
  };
}

test("Customer Economics decision signal sums disjoint acquisition groups exactly", () => {
  const signal = buildCustomerEconomicsDecisionSignal([
    row("2026-01-01", "1000.125", "actual"),
    row("2026-02-01", "-250.025", "actual"),
    row("2026-03-01", "0.9", "actual"),
  ]);

  assert.deepEqual(signal, {
    status: "ready",
    lifetimeContributionProfit: "751",
    evidenceQuality: "actual",
    currency: "USD",
    acquisitionGroupCount: 3,
    sourceReason: "ALL_GROUPS_ACTUAL",
  });
  assert.deepEqual(customerEconomicsDecisionQualitySignal(signal), {
    state: "ready",
    sourceReason: "ALL_GROUPS_ACTUAL",
  });
});

test("Customer Economics decision signal propagates estimated quality without hiding the value", () => {
  const signal = buildCustomerEconomicsDecisionSignal([
    row("2026-01-01", "125.50", "actual"),
    row("2026-02-01", "74.5", "estimated"),
  ]);

  assert.equal(signal.status, "ready");
  assert.equal(signal.lifetimeContributionProfit, "200");
  assert.equal(signal.evidenceQuality, "estimated");
  assert.equal(signal.sourceReason, "ESTIMATED_ALLOCATION_PRESENT");
});

test("one incomplete acquisition group blocks the downstream lifetime-profit judgment", () => {
  const signal = buildCustomerEconomicsDecisionSignal([
    row("2026-01-01", "500", "actual"),
    row("2026-02-01", null, "incomplete"),
  ]);

  assert.equal(signal.status, "incomplete");
  assert.equal(signal.lifetimeContributionProfit, null);
  assert.equal(signal.evidenceQuality, null);
  assert.deepEqual(customerEconomicsDecisionQualitySignal(signal), {
    state: "incomplete",
    sourceReason: "AT_LEAST_ONE_ACQUISITION_GROUP_INCOMPLETE",
  });
});

test("missing observations remain missing instead of becoming zero", () => {
  const signal = buildCustomerEconomicsDecisionSignal([]);
  assert.equal(signal.status, "missing");
  assert.equal(signal.lifetimeContributionProfit, null);
  assert.deepEqual(customerEconomicsDecisionQualitySignal(signal), {
    state: "missing",
    sourceReason: "NO_CUSTOMER_ECONOMICS_OBSERVATION",
  });
});

test("currency conflicts and duplicate acquisition groups fail closed", () => {
  const currencyConflict = buildCustomerEconomicsDecisionSignal([
    row("2026-01-01", "100", "actual", "USD"),
    row("2026-02-01", "200", "actual", "EUR"),
  ]);
  assert.equal(currencyConflict.status, "conflict");
  assert.equal(currencyConflict.lifetimeContributionProfit, null);

  const duplicate = buildCustomerEconomicsDecisionSignal([
    row("2026-01-01", "100", "actual"),
    row("2026-01-01", "200", "actual"),
  ]);
  assert.equal(duplicate.status, "conflict");
  assert.equal(duplicate.sourceReason, "DUPLICATE_OR_MISSING_ACQUISITION_GROUP");
});

test("a ready acquisition group with a malformed or missing profit fails closed", () => {
  const missing = buildCustomerEconomicsDecisionSignal([
    row("2026-01-01", null, "actual"),
  ]);
  assert.equal(missing.status, "conflict");
  assert.equal(missing.sourceReason, "READY_GROUP_MISSING_LIFETIME_CONTRIBUTION_PROFIT");

  const malformed = buildCustomerEconomicsDecisionSignal([
    row("2026-01-01", "1e3", "actual"),
  ]);
  assert.equal(malformed.status, "conflict");
  assert.equal(malformed.sourceReason, "INVALID_LIFETIME_CONTRIBUTION_PROFIT");
});
