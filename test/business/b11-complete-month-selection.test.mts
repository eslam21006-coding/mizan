import assert from "node:assert/strict";
import test from "node:test";
import {
  assessSavedSetupMonths,
  resolveSavedSetupMonthEligibility,
} from "../../src/lib/business/setup-month-readiness.ts";

const existing = "2026-08-01T08:00:00Z";
const later = "2026-10-01T08:00:00Z";
const period = (
  id: string,
  month: string,
  created_at = existing,
  new_customers: number | null = 4,
  total_paying_customers: number | null = 5,
) => ({
  id, month_start: `${month}-01`, created_at, new_customers, total_paying_customers,
});
const source = (id: string, is_active = true, created_at = existing) => ({
  id, name: id, stream_type: "front_end", is_active, created_at,
});
const expense = (
  id: string,
  cost_behavior = "fixed_monthly",
  is_active = true,
  created_at = existing,
) => ({
  id, name: id, category: "overhead", cost_behavior, is_active, created_at,
});
const revenue = (monthly_period_id: string, revenue_stream_id = "course", gross = "1000", refunds = "0") => ({
  monthly_period_id, revenue_stream_id, gross_cash_collected: gross, refunds,
});
const cost = (monthly_period_id: string, expense_item_id = "rent", input_value: string | null = "100") => ({
  monthly_period_id, expense_item_id, input_value, customer_count_basis: null,
});

test("B11.1 selects latest complete by calendar month, not latest saved or write order", () => {
  const assessment = assessSavedSetupMonths({
    periods: [
      period("sept", "2026-09", later),
      period("july", "2026-07", later),
      period("aug", "2026-08", existing),
    ],
    streams: [source("course")],
    expenses: [expense("rent")],
    revenueEntries: [revenue("aug"), revenue("july"), { monthly_period_id: "sept", revenue_stream_id: "course", gross_cash_collected: "3000" }],
    expenseEntries: [cost("aug"), cost("july"), cost("sept")],
  });
  assert.deepEqual(assessment.savedMonthKeys, ["2026-09", "2026-08", "2026-07"]);
  assert.deepEqual(assessment.completedMonthKeys, ["2026-08", "2026-07"]);
  assert.equal(assessment.validMonthCount, 2);
  assert.equal(assessment.latestSavedMonthKey, "2026-09");
  assert.equal(assessment.latestCompleteMonthKey, "2026-08");
  assert.deepEqual(resolveSavedSetupMonthEligibility(assessment, "2026-09"), {
    kind: "month_incomplete", monthKey: "2026-09",
  });
  assert.deepEqual(resolveSavedSetupMonthEligibility(assessment, "2026-08"), {
    kind: "ready", monthKey: "2026-08",
  });
  assert.deepEqual(resolveSavedSetupMonthEligibility(assessment, "2026-07"), {
    kind: "ready", monthKey: "2026-07",
  });
});

test("B11.1 historical rows keep saved archived snapshots, ignore newly configured costs and sources", () => {
  const assessment = assessSavedSetupMonths({
    periods: [period("aug", "2026-08")],
    streams: [
      source("course"), source("archived-vip", false),
      source("new-course", true, later),
    ],
    expenses: [
      expense("rent"), expense("legacy-fee", "percentage_revenue", false),
      expense("new-coach", "per_customer", true, later),
    ],
    revenueEntries: [
      revenue("aug"),
      { ...revenue("aug", "archived-vip", "0", "0"),
        stream_name_snapshot: "Original archived VIP", stream_type_snapshot: "backend" },
    ],
    expenseEntries: [
      cost("aug"),
      { ...cost("aug", "legacy-fee", "0.025"),
        expense_name_snapshot: "Original gateway fee",
        category_snapshot: "financial",
        cost_behavior_snapshot: "percentage_revenue" },
    ],
  });
  assert.equal(assessment.latestCompleteMonthKey, "2026-08");
  assert.deepEqual(resolveSavedSetupMonthEligibility(assessment, "2026-08"), {
    kind: "ready", monthKey: "2026-08",
  });
});

test("B11.1 confirmed zero is complete, but a missing basis or missing value is not", () => {
  const zero = assessSavedSetupMonths({
    periods: [period("zero", "2026-08", existing, 0, 0)],
    streams: [source("course")],
    expenses: [expense("coach", "per_customer")],
    revenueEntries: [revenue("zero", "course", "0", "0")],
    expenseEntries: [{ ...cost("zero", "coach", "0"), customer_count_basis: "new_customers" }],
  });
  assert.deepEqual(zero.completedMonthKeys, ["2026-08"]);
  const missingBasis = assessSavedSetupMonths({
    periods: [period("incomplete", "2026-09")],
    streams: [source("course")],
    expenses: [expense("coach", "per_customer")],
    revenueEntries: [revenue("incomplete")],
    expenseEntries: [cost("incomplete", "coach", "0")],
  });
  assert.deepEqual(missingBasis.completedMonthKeys, []);
  assert.deepEqual(resolveSavedSetupMonthEligibility(missingBasis, "2026-09"), {
    kind: "month_incomplete", monthKey: "2026-09",
  });
  const missingRefund = assessSavedSetupMonths({
    periods: [period("missing", "2026-09")],
    streams: [source("course")],
    expenses: [expense("rent")],
    revenueEntries: [{ monthly_period_id: "missing", revenue_stream_id: "course", gross_cash_collected: "100" }],
    expenseEntries: [cost("missing")],
  });
  assert.equal(missingRefund.latestCompleteMonthKey, null);
});

test("B11.1 exact requested-month resolver never substitutes latest complete, even on malformed input", () => {
  const assessment = assessSavedSetupMonths({
    periods: [period("aug", "2026-08")],
    streams: [source("course")],
    expenses: [],
    revenueEntries: [revenue("aug")],
    expenseEntries: [],
  });
  assert.deepEqual(resolveSavedSetupMonthEligibility(assessment, "2026-09"), {
    kind: "not_saved", monthKey: "2026-09",
  });
  assert.deepEqual(resolveSavedSetupMonthEligibility(assessment, undefined), {
    kind: "missing_month", monthKey: null,
  });
  for (const requested of ["2026-13", "2026-9", "September", ["2026-08", "2026-09"]]) {
    assert.deepEqual(resolveSavedSetupMonthEligibility(assessment, requested), {
      kind: "invalid_month", monthKey: null,
    });
  }
  assert.deepEqual(resolveSavedSetupMonthEligibility(null, "2026-08"), {
    kind: "load_error", monthKey: null,
  });
  assert.deepEqual(resolveSavedSetupMonthEligibility(null, "2026-13"), {
    kind: "load_error", monthKey: null,
  });
});

test("B11.1 never treats period existence alone or forged omitted rows as completeness", () => {
  const assessment = assessSavedSetupMonths({
    periods: [period("july", "2026-07")],
    streams: [source("course"), source("vip")],
    expenses: [expense("rent"), expense("unreported")],
    revenueEntries: [revenue("july")],
    expenseEntries: [cost("july")],
  });
  assert.deepEqual(assessment.completedMonthKeys, []);
  assert.equal(assessment.latestSavedMonthKey, "2026-07");
  assert.equal(assessment.latestCompleteMonthKey, null);
  assert.deepEqual(resolveSavedSetupMonthEligibility(assessment, "2026-07"), {
    kind: "month_incomplete", monthKey: "2026-07",
  });
});
