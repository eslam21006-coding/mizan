import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const setup = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/setup/expense-setup-content.tsx", import.meta.url),
  "utf8",
);
const drawer = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/expenses/expense-drawer.tsx", import.meta.url),
  "utf8",
);
const actions = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/expenses/actions.ts", import.meta.url),
  "utf8",
);

test("Setup Step 3 exposes named, confirmable deletion only to authorized managers", () => {
  assert.match(setup, /\{canManage \? \([\s\S]*?<form action=\{deleteExpenseItem\}>/);
  assert.match(setup, /<ConfirmSubmitButton[\s\S]*?confirmMessage=/);
  assert.match(setup, /ariaLabel=\{`حذف المصروف \$\{expense\.name\}`\}/);
  assert.match(setup, /name="business_id" value=\{businessId\}/);
  assert.match(setup, /name="expense_id" value=\{expense\.id\}/);
  assert.match(setup, /name="destination" value="setup"/);
  assert.match(setup, /لا يمكن حذف هذا المصروف لأنه مرتبط ببيانات محفوظة/);
});

test("Setup reuses the existing editor to deactivate historically linked expenses", () => {
  assert.match(setup, /<ExpenseDrawerLauncher[\s\S]*?mode="edit"[\s\S]*?destination="setup"/);
  assert.match(setup, /cost_behavior: expense\.costBehavior/);
  assert.match(drawer, /<input type="hidden" name="destination" value=\{destination\} \/>/);
  assert.match(drawer, /name="is_active"/);
  assert.match(setup, /"in-use": \{[\s\S]*?عطّله بدل الحذف/);
});

test("Edit and delete enforce allow-listed setup destination and retain the existing RLS/FK-protected mutations", () => {
  assert.match(actions, /export async function updateExpenseItem[\s\S]*?parseExpenseMutationDestination\(formData\)/);
  assert.match(actions, /export async function deleteExpenseItem[\s\S]*?parseExpenseMutationDestination\(formData\)/);
  assert.match(actions, /if \(!destination \|\| !expenseId\)/);
  assert.match(actions, /\.from\("expense_items"\)[\s\S]*?\.delete\(\)[\s\S]*?\.eq\("business_id", businessId\)/);
  assert.match(actions, /error\?\.code === "23503"/);
  assert.match(actions, /redirect\(resultPath\("in-use"\)\)/);
  assert.match(actions, /redirectAfterExpenseCreation\(businessId, "deleted", destination\)/);
  assert.doesNotMatch(setup, /\.from\("monthly_expense_entries"\)|\.update\(\{|\.delete\(\)/);
});
