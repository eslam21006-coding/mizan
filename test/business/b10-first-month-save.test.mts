import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateFirstMonthCompleteness } from "../../src/lib/business/first-month-completeness.ts";
import { assessSavedSetupMonths } from "../../src/lib/business/setup-month-readiness.ts";
import { storedExpenseValueForDisplay } from "../../src/lib/business/monthly.ts";
import { calculateCoreFinancials } from "../../src/lib/business/calculations.ts";
import { parseMonthlyExpenseInput } from "../../src/lib/business/monthly-expense-input.ts";

const firstMonthSetupLoader = await readFile(new URL("../../src/lib/business/first-month-setup.ts", import.meta.url), "utf8");

const createdAt = "2026-09-15T10:00:00Z";
const period = (overrides = {}) => ({
  id: "period-1", month_start: "2026-09-01", created_at: createdAt,
  new_customers: 10, total_paying_customers: 15,
  unallocated_gross_cash_collected: null, unallocated_refunds: null,
  ...overrides,
});
const source = (id: string, active = true, when = "2026-09-01T00:00:00Z") =>
  ({ id, name: id, stream_type: "front_end", is_active: active, created_at: when });
const expense = (id: string, behavior = "fixed_monthly", when = "2026-09-01T00:00:00Z") =>
  ({ id, name: id, category: "financial", cost_behavior: behavior, is_active: true, created_at: when });

test("B10 differentiates a saved empty draft, partial month, and explicitly confirmed zeroes", () => {
  const row = { id: "main", name: "Course", streamType: "front_end", active: true, gross: "", refunds: "" };
  const cost = { id: "fees", name: "Fees", category: "financial", behavior: "fixed_monthly", active: true, value: "", basis: "" };
  const incomplete = evaluateFirstMonthCompleteness({
    hasSavedPeriod: true, revenueRows: [row], expenseRows: [cost],
    period: { new_customers: null, total_paying_customers: null },
  });
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.meaningful, false);
  assert.ok(incomplete.missing.includes("gross:main"));
  const zeros = evaluateFirstMonthCompleteness({
    hasSavedPeriod: true, revenueRows: [{ ...row, gross: "0", refunds: "0" }],
    expenseRows: [{ ...cost, value: "0" }],
    period: { new_customers: 0, total_paying_customers: 0 },
  });
  assert.equal(zeros.complete, true);
  assert.equal(zeros.meaningful, true);
});

test("B10 requires a confirmed basis for each per-customer expense", () => {
  const input = { hasSavedPeriod: true, revenueRows: [
    { id: "main", name: "Course", streamType: "front_end", active: true, gross: "1000", refunds: "0" },
  ], expenseRows: [
    { id: "coach", name: "Coach", category: "fulfillment", behavior: "per_customer", active: true, value: "20", basis: "" },
  ], period: { new_customers: 3, total_paying_customers: 4 } };
  assert.equal(evaluateFirstMonthCompleteness(input).complete, false);
  assert.ok(evaluateFirstMonthCompleteness(input).missing.includes("basis:coach"));
  assert.equal(evaluateFirstMonthCompleteness({
    ...input, expenseRows: [{ ...input.expenseRows[0], basis: "total_paying_customers" }],
  }).complete, true);
});

test("B10 derives readiness from confirmed persisted rows, retaining historical snapshots", () => {
  const result = assessSavedSetupMonths({
    periods: [period()],
    streams: [
      source("main"), source("archived", false),
      source("added-later", true, "2026-10-01T00:00:00Z"),
    ],
    expenses: [expense("fees", "percentage_revenue")],
    revenueEntries: [
      { monthly_period_id: "period-1", revenue_stream_id: "main", gross_cash_collected: "14000", refunds: "500" },
      { monthly_period_id: "period-1", revenue_stream_id: "archived", stream_name_snapshot: "Legacy",
        stream_type_snapshot: "backend", gross_cash_collected: "0", refunds: "0" },
    ],
    expenseEntries: [
      { monthly_period_id: "period-1", expense_item_id: "fees", input_value: "0.035",
        cost_behavior_snapshot: "percentage_revenue" },
    ],
  });
  assert.equal(result.validMonthCount, 1);
  assert.deepEqual(result.completedMonthKeys, ["2026-09"]);
  assert.equal(storedExpenseValueForDisplay("0.035", "percentage_revenue"), "3.5");
});

test("B10 Setup cannot mark a saved month complete from unsaved transaction-derived customer counts", () => {
  const saved = period({ new_customers: null, total_paying_customers: null });
  const displayOnly = { ...saved, new_customers: 4, total_paying_customers: 5 };
  const revenueRows = [
    { id: "main", name: "Course", streamType: "front_end", active: true, gross: "1000", refunds: "0" },
  ];
  assert.equal(evaluateFirstMonthCompleteness({
    hasSavedPeriod: true, period: displayOnly, revenueRows, expenseRows: [],
  }).complete, true);

  const stored = evaluateFirstMonthCompleteness({
    hasSavedPeriod: true, period: saved, revenueRows, expenseRows: [],
  });
  assert.equal(stored.complete, false);
  assert.ok(stored.missing.includes("new_customers"));
  assert.ok(stored.missing.includes("total_paying_customers"));

  const canonical = assessSavedSetupMonths({
    periods: [saved],
    streams: [source("main")],
    expenses: [],
    revenueEntries: [
      { monthly_period_id: saved.id, revenue_stream_id: "main", gross_cash_collected: "1000", refunds: "0" },
    ],
    expenseEntries: [],
  });
  assert.equal(canonical.validMonthCount, 0);
  assert.match(firstMonthSetupLoader,
    /hasSavedPeriod: Boolean\(period\),\s*period,\s*revenueRows: applicableRows\.revenueRows/);
  assert.match(firstMonthSetupLoader, /period: effectivePeriod,/);
});

test("B10 cannot complete with forged omission of an active source or expense", () => {
  const result = assessSavedSetupMonths({
    periods: [period()],
    streams: [source("main"), source("vip")],
    expenses: [expense("fees")],
    revenueEntries: [
      { monthly_period_id: "period-1", revenue_stream_id: "main", gross_cash_collected: "100", refunds: "0" },
    ],
    expenseEntries: [],
  });
  assert.equal(result.validMonthCount, 0);
});

test("B10 preserves the existing financial engine rather than creating a Setup-only calculation", () => {
  const result = calculateCoreFinancials({
    revenueStreams: [
      { id: "front", name: "Course", streamType: "front_end", grossCashCollected: "10000", refunds: "500" },
      { id: "backend", name: "VIP", streamType: "backend", grossCashCollected: "4000", refunds: "0" },
    ],
    expenses: [
      { id: "ads", name: "Ads", category: "acquisition", behavior: "fixed_monthly", inputValue: "2000" },
      { id: "coach", name: "Coach", category: "fulfillment", behavior: "per_customer", inputValue: "20",
        customerCountBasis: "total_paying_customers" },
      { id: "rent", name: "Rent", category: "overhead", behavior: "fixed_monthly", inputValue: "1000" },
      { id: "fees", name: "Fees", category: "financial", behavior: "percentage_revenue", inputValue: "0.035" },
    ],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers: 10,
    totalPayingCustomers: 15,
    canonicalAdSpend: "2000",
  });
  assert.deepEqual(result.netCashCollected, { available: true, value: "13500" });
  assert.deepEqual(result.realNetProfit, { available: true, value: "9727.5" });
  assert.deepEqual(result.ultimateCac, { available: true, value: { numerator: "1509", denominator: "4" } });
});

test("B10 allows genuinely blank new per-customer costs, but requires a basis for a positive or zero cost", () => {
  const base = {
    id: "e1111111-1111-4111-8111-111111111111",
    valueFields: [""],
    basisFields: [""],
    behavior: "per_customer",
    setupDraft: true,
    existingSavedRow: false,
  };
  assert.deepEqual(parseMonthlyExpenseInput(base), { kind: "skip" });
  assert.deepEqual(parseMonthlyExpenseInput({ ...base, valueFields: ["0"] }).kind, "error");
  assert.deepEqual(parseMonthlyExpenseInput({ ...base, valueFields: ["20"] }).kind, "error");
  assert.deepEqual(parseMonthlyExpenseInput({ ...base, existingSavedRow: true }).kind, "error");
  const zeroWithBasis = parseMonthlyExpenseInput({
    ...base, valueFields: ["0"], basisFields: ["total_paying_customers"],
  });
  assert.deepEqual(zeroWithBasis, {
    kind: "entry",
    entry: {
      expense_item_id: base.id,
      display_value: "0",
      customer_count_basis: "total_paying_customers",
    },
  });
  assert.equal(parseMonthlyExpenseInput({ ...base, setupDraft: false }).kind, "entry");
});

test("B10 rejects malformed, negative, duplicated and inconsistent submitted expense fields", () => {
  const base = {
    id: "e1111111-1111-4111-8111-111111111111",
    valueFields: ["3.5"],
    basisFields: [],
    behavior: "percentage_revenue",
    setupDraft: true,
    existingSavedRow: false,
  };
  for (const valueFields of [["-1"], ["3.5", "3.7"], ["1,2"], ["1.123456789"]]) {
    const result = parseMonthlyExpenseInput({ ...base, valueFields });
    assert.equal(result.kind, "error");
    if (result.kind === "error") assert.equal(result.field, `expense_value_${base.id}`);
  }
  for (const basisFields of [["new_customers"], ["not_a_basis"], ["", ""]]) {
    const result = parseMonthlyExpenseInput({ ...base, basisFields });
    assert.equal(result.kind, "error");
    if (result.kind === "error") assert.equal(result.field, `expense_basis_${base.id}`);
  }
  assert.deepEqual(parseMonthlyExpenseInput(base), {
    kind: "entry",
    entry: { expense_item_id: base.id, display_value: "3.5", customer_count_basis: null },
  });
});

test("B10 keeps saved historical expense behavior when live definitions change", () => {
  const original = {
    id: "e1111111-1111-4111-8111-111111111111",
    valueFields: ["20"],
    basisFields: [],
    behavior: "per_customer",
    setupDraft: true,
    existingSavedRow: true,
  };
  const missingBasis = parseMonthlyExpenseInput(original);
  assert.equal(missingBasis.kind, "error");
  const valid = parseMonthlyExpenseInput({
    ...original, basisFields: ["new_customers"],
  });
  assert.equal(valid.kind, "entry");
  if (valid.kind === "entry") assert.equal(valid.entry.customer_count_basis, "new_customers");
});

const actions = await readFile(new URL("../../src/app/(app)/businesses/[businessId]/monthly/actions.ts", import.meta.url), "utf8");
const service = await readFile(new URL("../../src/lib/business/monthly-save-service.ts", import.meta.url), "utf8");
const setupAction = await readFile(new URL("../../src/app/(app)/businesses/[businessId]/setup/first-month-actions.ts", import.meta.url), "utf8");
const loader = await readFile(new URL("../../src/lib/business/setup-loader.ts", import.meta.url), "utf8");

test("B10 keeps exactly one save RPC path and derives canonical readiness from data", () => {
  assert.match(actions, /persistMonthlyActuals\(formData\)/);
  assert.match(
    setupAction,
    /persistMonthlyActuals\(formData, \{[\s\S]*setupDraft: true,[\s\S]*recoverUncertainWrite: true,[\s\S]*\}\)/,
  );
  assert.match(service, /await requireAuthContext\(\)/);
  assert.match(service, /\.rpc\("save_monthly_actuals"/);
  assert.doesNotMatch(setupAction, /\.rpc\(/);
  assert.match(loader, /assessSavedSetupMonths/);
  assert.match(setupAction, /preserveDraft\(formData\)/);
  assert.match(service, /existingExpenseIds\.has\(id\)/);
  assert.doesNotMatch(service, /\.from\("monthly_periods"\)\.(insert|upsert|update)/);
});
