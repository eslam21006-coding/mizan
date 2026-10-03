import assert from "node:assert/strict";
import test from "node:test";
import { readAllSetupPages, SETUP_READ_PAGE_SIZE } from "../../src/lib/business/setup-paged-rows.ts";
import { assessSavedSetupMonths } from "../../src/lib/business/setup-month-readiness.ts";

function pageSource<T>(rows: T[], serverCap = SETUP_READ_PAGE_SIZE, withCount = true) {
  const requests: Array<[number, number]> = [];
  return {
    requests,
    fetch(from: number, to: number) {
      requests.push([from, to]);
      return Promise.resolve({
        data: rows.slice(from, Math.min(to + 1, from + serverCap)),
        error: null,
        count: withCount ? rows.length : null,
      });
    },
  };
}

test("B10 reads empty, below-limit, exact-1000, 1001 and multi-page datasets without truncation", async () => {
  for (const count of [0, 999, 1000, 1001, 2501]) {
    const rows = Array.from({ length: count }, (_, id) => ({ id }));
    const source = pageSource(rows);
    const result = await readAllSetupPages(source.fetch);
    assert.equal(result.error, null, `Failed at count ${count}`);
    assert.deepEqual(result.data, rows);
    if (count > 1000) assert.ok(source.requests.length >= 2);
    if (count === 1000) assert.equal(source.requests.length, 1);
  }
});

test("B10 continues pagination when the Supabase server caps result pages below the requested range", async () => {
  const rows = Array.from({ length: 1025 }, (_, id) => ({ id }));
  const source = pageSource(rows, 400);
  const result = await readAllSetupPages(source.fetch);
  assert.equal(result.error, null);
  assert.deepEqual(result.data, rows);
  assert.deepEqual(source.requests, [[0, 999], [400, 1399], [800, 1799]]);
});

test("B10 reads an exact 1000-row boundary even when a count is not returned", async () => {
  const rows = Array.from({ length: 1000 }, (_, id) => ({ id }));
  const source = pageSource(rows, SETUP_READ_PAGE_SIZE, false);
  const result = await readAllSetupPages(source.fetch);
  assert.deepEqual(result.data, rows);
  assert.deepEqual(source.requests, [[0, 999], [1000, 1999]]);
});

test("B10 fails closed on a later-page error, missing data, or an underfilled inconsistent count", async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const source = pageSource(rows);
  const failed = await readAllSetupPages(async (from, to) => from === 0
    ? source.fetch(from, to)
    : { data: null, error: { message: "Permission denied" }, count: null });
  assert.equal(failed.data, null);
  assert.match(failed.error?.message ?? "", /Permission denied/);

  const missing = await readAllSetupPages(async () =>
    ({ data: null, error: null, count: 3 }));
  assert.equal(missing.data, null);
  assert.match(missing.error?.message ?? "", /no data/);

  const truncated = await readAllSetupPages(async (from) =>
    from === 0
      ? { data: rows.slice(0, 1000), error: null, count: 1001 }
      : { data: [], error: null, count: 1001 });
  assert.equal(truncated.data, null);
  assert.match(truncated.error?.message ?? "", /before all records/);
});

test("B10 assesses readiness across more than 1000 saved expense entries", async () => {
  const expenses = Array.from({ length: 25 }, (_, i) => ({
    id: `expense-${i}`, name: `Expense ${i}`, category: "overhead",
    cost_behavior: "fixed_monthly", is_active: true, created_at: "2026-01-01T00:00:00Z",
  }));
  const periods = Array.from({ length: 41 }, (_, i) => ({
    id: `period-${i}`, month_start: new Date(Date.UTC(2026, i, 1)).toISOString().slice(0, 10),
    created_at: "2026-02-01T00:00:00Z", new_customers: 10, total_paying_customers: 12,
  }));
  const revenue = periods.map((period) => ({
    monthly_period_id: period.id, revenue_stream_id: "course",
    gross_cash_collected: "5000", refunds: "0",
  }));
  const expenseEntries = periods.flatMap((period) => expenses.map((expense) => ({
    monthly_period_id: period.id, expense_item_id: expense.id,
    input_value: "0", customer_count_basis: null,
  })));
  assert.ok(expenseEntries.length > 1000);
  const pages = pageSource(expenseEntries);
  const pagedExpenses = await readAllSetupPages(pages.fetch);
  assert.equal(pagedExpenses.error, null);
  assert.ok(pages.requests.length >= 2);

  const assessed = assessSavedSetupMonths({
    periods,
    streams: [{
      id: "course", name: "Course", stream_type: "front_end", is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    }],
    expenses,
    revenueEntries: revenue,
    expenseEntries: pagedExpenses.data ?? [],
  });
  assert.equal(assessed.validMonthCount, 41);
  assert.equal(assessed.completedMonthKeys.length, 41);
});
