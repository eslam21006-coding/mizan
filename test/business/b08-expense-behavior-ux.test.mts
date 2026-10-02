import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EXPENSE_COST_BEHAVIORS,
  EXPENSE_COST_BEHAVIOR_OPTIONS,
  isVariableExpenseBehavior,
  parseExpenseCostBehavior,
} from "../../src/lib/business/expenses.ts";

const drawerSource = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/expenses/expense-drawer.tsx",
    import.meta.url,
  ),
  "utf8",
);
const workspaceSource = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/expenses/page.tsx", import.meta.url),
  "utf8",
);
const setupSource = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/setup/expense-setup-content.tsx",
    import.meta.url,
  ),
  "utf8",
);
const actionSource = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/expenses/actions.ts", import.meta.url),
  "utf8",
);

test("B08 defines exactly three founder-facing labels for the existing expense behavior values", () => {
  assert.deepEqual([...EXPENSE_COST_BEHAVIORS], [
    "fixed_monthly",
    "per_customer",
    "percentage_revenue",
  ]);
  assert.deepEqual(
    EXPENSE_COST_BEHAVIOR_OPTIONS.map(({ value, label }) => ({ value, label })),
    [
      { value: "fixed_monthly", label: "مبلغ ثابت تقريبًا" },
      { value: "per_customer", label: "تزيد مع عدد العملاء" },
      { value: "percentage_revenue", label: "نسبة من الإيراد" },
    ],
  );
  assert.ok(EXPENSE_COST_BEHAVIOR_OPTIONS.every(({ description }) => description.trim()));
});

test("B08 keeps expense behavior storage accepting internal values, never translated labels", () => {
  for (const behavior of EXPENSE_COST_BEHAVIORS) {
    assert.equal(parseExpenseCostBehavior(behavior), behavior);
    assert.equal(parseExpenseCostBehavior(` ${behavior} `), behavior);
  }
  for (const invalid of [
    "مبلغ ثابت تقريبًا",
    "تزيد مع عدد العملاء",
    "نسبة من الإيراد",
    "annual",
    "",
  ]) {
    assert.equal(parseExpenseCostBehavior(invalid), null);
  }
  assert.match(actionSource, /parseExpenseCostBehavior\(formData\.get\("cost_behavior"\)\)/);
});

test("B08 preserves fixed versus variable semantics and known-number contribution", () => {
  assert.equal(isVariableExpenseBehavior("fixed_monthly"), false);
  assert.equal(isVariableExpenseBehavior("per_customer"), true);
  assert.equal(isVariableExpenseBehavior("percentage_revenue"), true);
  const cashCollected = 4000;
  const expenses = [
    { behavior: "fixed_monthly" as const, amount: 900 },
    { behavior: "per_customer" as const, amount: 350 },
    { behavior: "percentage_revenue" as const, amount: 120 },
  ];
  const variable = expenses
    .filter(({ behavior }) => isVariableExpenseBehavior(behavior))
    .reduce((total, expense) => total + expense.amount, 0);
  assert.equal(variable, 470);
  assert.equal(cashCollected - variable, 3530);
});

test("B08 drawer asks the founder-facing question and submits canonical cost_behavior in create and edit", () => {
  assert.match(drawerSource, /كيف تُحسب هذه التكلفة؟/);
  assert.doesNotMatch(drawerSource, />طريقة التكلفة</);
  assert.match(drawerSource, /action=\{isCreate \? createExpenseItem : updateExpenseItem\}/);
  assert.match(drawerSource, /name="cost_behavior"/);
  assert.match(drawerSource, /defaultValue=\{expense\?\.cost_behavior \?\? "fixed_monthly"\}/);
  assert.match(drawerSource, /<option value=\{option\.value\} key=\{option\.value\}>/);
  assert.match(drawerSource, /\{option\.label\}/);
});

test("B08 shares one behavior mapping between setup and workspace without changing actions or model", () => {
  assert.match(setupSource, /behaviorOptions=\{EXPENSE_COST_BEHAVIOR_OPTIONS\}/);
  assert.match(workspaceSource, /behaviorOptions=\{EXPENSE_COST_BEHAVIOR_OPTIONS\}/);
  assert.match(workspaceSource, /EXPENSE_COST_BEHAVIOR_OPTIONS\.find/);
  assert.match(actionSource, /cost_behavior:\s*costBehavior/);
});
