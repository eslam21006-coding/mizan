import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  currentMonthKeyForTimeZone,
  normalizeAdjustmentNote,
  normalizeLocalizedDigits,
  parseCustomerCountBasis,
  parseMonthKey,
  parseOptionalCountInput,
  parseOptionalDecimalInput,
  shiftMonthKey,
  storedExpenseValueForDisplay,
} from "../../src/lib/business/monthly.ts";
import { buildExecutionPlan } from "../rls/run-attack-matrix.mjs";

const migration = await readFile(
  new URL("../../supabase/migrations/20260819070000_task_8_monthly_data_entry.sql", import.meta.url),
  "utf8",
);

test("localized numeric input accepts Arabic digits without silently interpreting ASCII commas", () => {
  assert.equal(normalizeLocalizedDigits("١٢٣.٤٥"), "123.45");
  assert.deepEqual(parseOptionalDecimalInput("١٢٣٫٤٥"), { ok: true, value: "123.45" });
  assert.deepEqual(parseOptionalDecimalInput("۱۲۳٫۴۵"), { ok: true, value: "123.45" });
  assert.deepEqual(parseOptionalDecimalInput("1,000"), { ok: false, value: null });
  assert.deepEqual(parseOptionalDecimalInput(""), { ok: true, value: null });
  assert.deepEqual(parseOptionalDecimalInput("-1"), { ok: false, value: null });
});

test("customer counts preserve missing versus zero and reject invalid integers", () => {
  assert.deepEqual(parseOptionalCountInput(""), { ok: true, value: null });
  assert.deepEqual(parseOptionalCountInput("٠"), { ok: true, value: 0 });
  assert.deepEqual(parseOptionalCountInput("12"), { ok: true, value: 12 });
  assert.deepEqual(parseOptionalCountInput("1.5"), { ok: false, value: null });
  assert.deepEqual(parseOptionalCountInput("-1"), { ok: false, value: null });
});

test("month helpers validate and navigate calendar months", () => {
  assert.deepEqual(parseMonthKey("٢٠٢٦-٠٨"), {
    monthKey: "2026-08",
    monthStart: "2026-08-01",
  });
  assert.equal(parseMonthKey("2026-13"), null);
  assert.equal(shiftMonthKey("2026-01", -1), "2025-12");
  assert.equal(shiftMonthKey("2026-12", 1), "2027-01");
});

test("current month respects business timezone around month boundaries", () => {
  const instant = new Date("2026-08-31T22:30:00.000Z");
  assert.equal(currentMonthKeyForTimeZone("Africa/Cairo", instant), "2026-09");
  assert.equal(currentMonthKeyForTimeZone("America/New_York", instant), "2026-08");
});

test("invalid stored timezone cannot crash monthly entry and falls back to UTC month", () => {
  const instant = new Date("2026-08-31T22:30:00.000Z");
  assert.equal(currentMonthKeyForTimeZone("Invalid/Zone", instant), "2026-08");
});

test("percentage storage is rendered back as a human percent without floating-point arithmetic", () => {
  assert.equal(storedExpenseValueForDisplay("0.10", "percentage_revenue"), "10");
  assert.equal(storedExpenseValueForDisplay("1.5", "percentage_revenue"), "150");
  assert.equal(storedExpenseValueForDisplay("20", "fixed_monthly"), "20");
  assert.equal(storedExpenseValueForDisplay(null, "percentage_revenue"), "");
});

test("per-customer basis accepts only the two explicit stored choices", () => {
  assert.equal(parseCustomerCountBasis("new_customers"), "new_customers");
  assert.equal(parseCustomerCountBasis("total_paying_customers"), "total_paying_customers");
  assert.equal(parseCustomerCountBasis("customers"), null);
  assert.equal(parseCustomerCountBasis(""), null);
});

test("adjustment note normalization enforces the database limit", () => {
  assert.equal(normalizeAdjustmentNote("  مراجعة يدوية  "), "مراجعة يدوية");
  assert.equal(normalizeAdjustmentNote("x".repeat(501)), null);
});

test("Task 8 monthly tables are read-only directly and writes are controlled by management RPCs", () => {
  assert.match(migration, /grant select on public\.monthly_periods to authenticated/i);
  assert.doesNotMatch(migration, /grant[^;]*(insert|update|delete)[^;]*monthly_periods[^;]*authenticated/i);
  assert.match(migration, /security definer[\s\S]*private\.can_manage_business\(target_business_id\)/i);
  assert.match(migration, /public\.save_monthly_actuals/);
  assert.match(migration, /public\.copy_previous_month_expenses/);
});

test("Task 8 preserves required financial input invariants in PostgreSQL", () => {
  assert.match(migration, /new_customers <= total_paying_customers/);
  assert.match(migration, /customer_count_basis in \('new_customers', 'total_paying_customers'\)/);
  assert.match(migration, /display_value \/ 100/);
  assert.match(migration, /gross_cash_collected is null or gross_cash_collected >= 0/);
  assert.match(migration, /refunds is null or refunds >= 0/);
});

test("Task 8 deliberately stores raw inputs without Task 9 calculated KPI columns", () => {
  assert.doesNotMatch(migration, /real_net_profit/i);
  assert.doesNotMatch(migration, /ultimate_cac/i);
  assert.doesNotMatch(migration, /contribution_profit/i);
  assert.doesNotMatch(migration, /\bmer\b/i);
  assert.doesNotMatch(migration, /net_cash_collected\s+numeric/i);
});

test("Task 8 migration and database attack matrix are executed in CI", () => {
  const files = buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/mizan_test").map(
    (execution) => execution.sqlFile,
  );
  const migrationIndex = files.indexOf(
    "supabase/migrations/20260819070000_task_8_monthly_data_entry.sql",
  );
  const testIndex = files.indexOf("test/business/task-8-monthly-data-entry.test.sql");
  assert.ok(migrationIndex >= 0);
  assert.ok(testIndex > migrationIndex);
});
