import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_COST_BEHAVIORS,
  isVariableExpenseBehavior,
  normalizeExpenseName,
  parseExpenseCategory,
  parseExpenseCostBehavior,
} from "../../src/lib/business/expenses.ts";
import { buildExecutionPlan } from "../rls/run-attack-matrix.mjs";

const action = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/expenses/actions.ts", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/expenses/page.tsx", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL("../../supabase/migrations/20260819060840_task_7_expense_structure.sql", import.meta.url),
  "utf8",
);

test("Task 7 supports exactly the four Mizan expense categories", () => {
  assert.deepEqual([...EXPENSE_CATEGORIES], [
    "acquisition",
    "fulfillment",
    "overhead",
    "financial",
  ]);
  assert.equal(parseExpenseCategory("acquisition"), "acquisition");
  assert.equal(parseExpenseCategory("fulfillment"), "fulfillment");
  assert.equal(parseExpenseCategory("overhead"), "overhead");
  assert.equal(parseExpenseCategory("financial"), "financial");
  assert.equal(parseExpenseCategory("refund"), null);
});

test("Task 7 supports exactly fixed monthly, per customer, and percentage of revenue behavior", () => {
  assert.deepEqual([...EXPENSE_COST_BEHAVIORS], [
    "fixed_monthly",
    "per_customer",
    "percentage_revenue",
  ]);
  assert.equal(parseExpenseCostBehavior("fixed_monthly"), "fixed_monthly");
  assert.equal(parseExpenseCostBehavior("per_customer"), "per_customer");
  assert.equal(parseExpenseCostBehavior("percentage_revenue"), "percentage_revenue");
  assert.equal(parseExpenseCostBehavior("annual"), null);
});

test("Task 7 numerical classification keeps fixed monthly costs out of variable costs", () => {
  const knownExpenses = [
    { behavior: "fixed_monthly" as const, actualCost: 1200 },
    { behavior: "per_customer" as const, actualCost: 450 },
    { behavior: "percentage_revenue" as const, actualCost: 350 },
  ];

  const totalCosts = knownExpenses.reduce((sum, expense) => sum + expense.actualCost, 0);
  const variableCosts = knownExpenses
    .filter((expense) => isVariableExpenseBehavior(expense.behavior))
    .reduce((sum, expense) => sum + expense.actualCost, 0);

  assert.equal(totalCosts, 2000);
  assert.equal(variableCosts, 800);
  assert.equal(totalCosts - variableCosts, 1200);
});

test("expense names normalize whitespace and enforce length", () => {
  assert.equal(normalizeExpenseName("  رسوم   بوابة الدفع  "), "رسوم بوابة الدفع");
  assert.equal(normalizeExpenseName(""), null);
  assert.equal(normalizeExpenseName("x".repeat(121)), null);
});

test("expense writes rely on authenticated context and business RLS boundary", () => {
  assert.match(action, /await requireAuthContext\(\)/);
  assert.doesNotMatch(page, /name=["']owner_user_id["']/);
  assert.doesNotMatch(page, /name=["']user_id["']/);
  assert.match(action, /\.eq\("business_id", businessId\)/);
});

test("Task 7 create delivery is database-idempotent", () => {
  assert.match(page, /name="creation_request_id" value=\{randomUUID\(\)\}/);
  assert.match(action, /creation_request_id:\s*creationRequestId/);
  assert.match(action, /!error \|\| error\.code === "23505"/);
});

test("Task 7 intentionally stores structure without monthly financial values", () => {
  assert.doesNotMatch(migration, /default_amount/i);
  assert.doesNotMatch(migration, /monthly_amount/i);
  assert.doesNotMatch(migration, /percentage_rate/i);
  assert.doesNotMatch(migration, /per_customer_amount/i);
});

test("Task 7 intentionally has no authenticated hard-delete path", () => {
  assert.doesNotMatch(action, /\.delete\(\)/);
  assert.match(migration, /grant select, insert, update on public\.expense_items to authenticated/i);
  assert.doesNotMatch(migration, /grant[^;]*delete[^;]*expense_items[^;]*authenticated/i);
  assert.doesNotMatch(migration, /create policy expense_items_delete/i);
});

test("Task 7 migration and attack matrix execute in database-backed CI", () => {
  const plan = buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/mizan_test");
  const executedFiles = plan.map((execution) => {
    const fileFlagIndex = execution.args.indexOf("--file");
    assert.notEqual(fileFlagIndex, -1);
    return execution.args[fileFlagIndex + 1];
  });

  assert.ok(
    executedFiles.includes("supabase/migrations/20260819060840_task_7_expense_structure.sql"),
  );
  assert.ok(executedFiles.includes("test/business/task-7-expense-structure.test.sql"));
});

test("Task 7 RLS uses the established read and manage business boundaries", () => {
  assert.match(migration, /alter table public\.expense_items enable row level security/i);
  assert.match(migration, /private\.can_read_business\(business_id\)/);
  assert.match(migration, /private\.can_manage_business\(business_id\)/);
  assert.match(migration, /before update of creation_request_id on public\.expense_items/i);
});
