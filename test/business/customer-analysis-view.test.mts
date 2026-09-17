import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomerAnalysisViewHref,
  parseCustomerAnalysisView,
} from "../../src/lib/customer-analysis-view.ts";

test("defaults missing, invalid, and ambiguous Customer view state to overview", () => {
  assert.equal(parseCustomerAnalysisView(undefined), "overview");
  assert.equal(parseCustomerAnalysisView("unknown"), "overview");
  assert.equal(parseCustomerAnalysisView(["customers", "profitability"]), "overview");
});

test("accepts known Customer view state from direct URL input", () => {
  assert.equal(parseCustomerAnalysisView("profitability"), "profitability");
  assert.equal(parseCustomerAnalysisView(["customers"]), "customers");
});

test("builds business-scoped Customer view URLs while preserving unrelated query state", () => {
  assert.equal(
    buildCustomerAnalysisViewHref(
      "business/01",
      { view: "unknown", month: "2026-08", sort: "revenue" },
      "customers",
    ),
    "/businesses/business%2F01/customers?view=customers&month=2026-08&sort=revenue",
  );
});

test("supports an explicit fixture base path without changing preserved query state", () => {
  assert.equal(
    buildCustomerAnalysisViewHref(
      "business/01",
      { view: "overview", month: "2026-08" },
      "profitability",
      "/auth/e2e-customer-tabs",
    ),
    "/auth/e2e-customer-tabs?view=profitability&month=2026-08",
  );
});
