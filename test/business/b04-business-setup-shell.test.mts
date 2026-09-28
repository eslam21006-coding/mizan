import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBusinessSetupHref,
  businessSetupStepForRequirement,
  nextBusinessSetupStep,
  parseBusinessSetupStep,
  previousBusinessSetupStep,
  resolveBusinessSetupResumeStep,
} from "../../src/lib/business/setup-navigation.ts";
import { resolveCoreSetupReadiness } from "../../src/lib/business/readiness.ts";

test("B04 setup step parser accepts only one canonical semantic step", () => {
  for (const step of ["business", "revenue", "expenses", "month"] as const) {
    assert.deepEqual(parseBusinessSetupStep(step), { kind: "valid", step });
  }

  assert.deepEqual(parseBusinessSetupStep(undefined), { kind: "missing" });
  assert.deepEqual(parseBusinessSetupStep(""), { kind: "invalid" });
  assert.deepEqual(parseBusinessSetupStep("2"), { kind: "invalid" });
  assert.deepEqual(parseBusinessSetupStep("costs"), { kind: "invalid" });
  assert.deepEqual(parseBusinessSetupStep(["revenue", "expenses"]), { kind: "invalid" });
});

test("B04 setup hrefs are business-scoped, encoded, and semantic", () => {
  assert.equal(
    buildBusinessSetupHref("business fixture/01", "expenses"),
    "/businesses/business%20fixture%2F01/setup?step=expenses",
  );
  assert.equal(
    buildBusinessSetupHref("business fixture/01"),
    "/businesses/business%20fixture%2F01/setup",
  );
});

test("B04 Core requirements map to stable wizard steps", () => {
  assert.equal(businessSetupStepForRequirement("business_identity"), "business");
  assert.equal(businessSetupStepForRequirement("revenue_setup"), "revenue");
  assert.equal(businessSetupStepForRequirement("expense_setup_review"), "expenses");
  assert.equal(businessSetupStepForRequirement("first_valid_month"), "month");
});

test("B04 Back and Next follow wizard order, not browser history", () => {
  assert.equal(previousBusinessSetupStep("business"), null);
  assert.equal(previousBusinessSetupStep("revenue"), "business");
  assert.equal(previousBusinessSetupStep("expenses"), "revenue");
  assert.equal(previousBusinessSetupStep("month"), "expenses");

  assert.equal(nextBusinessSetupStep("business"), "revenue");
  assert.equal(nextBusinessSetupStep("revenue"), "expenses");
  assert.equal(nextBusinessSetupStep("expenses"), "month");
  assert.equal(nextBusinessSetupStep("month"), null);
});

test("B04 resume always uses the first missing canonical Core requirement", () => {
  const empty = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 0,
    expenseSetup: "not_reviewed",
    validMonthCount: 0,
  });
  const revenueOnly = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup: "not_reviewed",
    validMonthCount: 0,
  });
  const revenueAndExpenses = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup: "reviewed",
    validMonthCount: 0,
  });
  const complete = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup: "reviewed",
    validMonthCount: 1,
  });

  assert.equal(resolveBusinessSetupResumeStep(empty), "revenue");
  assert.equal(resolveBusinessSetupResumeStep(revenueOnly), "expenses");
  assert.equal(resolveBusinessSetupResumeStep(revenueAndExpenses), "month");
  assert.equal(resolveBusinessSetupResumeStep(complete), null);
});

test("B04 load errors never fabricate a resume step", () => {
  const failed = resolveCoreSetupReadiness({
    loadState: "load_error",
    businessIdentityReady: null,
    revenueSourceCount: null,
    expenseSetup: "unknown",
    validMonthCount: null,
  });

  assert.equal(resolveBusinessSetupResumeStep(failed), null);
});
