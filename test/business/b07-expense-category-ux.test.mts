import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_SETUP_CATEGORY_OPTIONS,
} from "../../src/lib/business/expenses.ts";

const setupLoaderSource = await readFile(
  new URL("../../src/lib/business/setup-loader.ts", import.meta.url),
  "utf8",
);
const setupExpenseSource = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/setup/expense-setup-content.tsx",
    import.meta.url,
  ),
  "utf8",
);
const setupShellSource = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/setup/business-setup-shell.tsx",
    import.meta.url,
  ),
  "utf8",
);
const expenseActionsSource = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/expenses/actions.ts",
    import.meta.url,
  ),
  "utf8",
);
const expenseDrawerSource = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/expenses/expense-drawer.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("B07 Tasks 1-2 keep exactly the four authoritative expense categories with founder-facing copy", () => {
  assert.deepEqual(EXPENSE_CATEGORIES, [
    "acquisition",
    "fulfillment",
    "overhead",
    "financial",
  ]);
  assert.deepEqual(
    EXPENSE_SETUP_CATEGORY_OPTIONS.map(({ value, label }) => ({ value, label })),
    [
      { value: "acquisition", label: "الإعلان وجلب العملاء" },
      { value: "fulfillment", label: "تقديم الخدمة للعملاء" },
      { value: "overhead", label: "تشغيل البزنس" },
      { value: "financial", label: "تكاليف مالية" },
    ],
  );
  assert.match(setupExpenseSource, /Meta Ads/);
  assert.match(setupExpenseSource, /Coach/);
  assert.match(setupExpenseSource, /Software/);
  assert.match(setupExpenseSource, /Payment processor fees/);
});

test("B07 Task 1 loads display rows plus independent authoritative active counts", () => {
  assert.match(
    setupLoaderSource,
    /from\("expense_items"\)[\s\S]*select\("id,name,category,cost_behavior,is_active"\)/,
  );
  for (const category of EXPENSE_CATEGORIES) {
    assert.match(
      setupLoaderSource,
      new RegExp(
        String.raw`select\\("id", \\{ count: "exact", head: true \\}\\)[\\s\\S]*?\\.eq\\("category", "${category}"\\)[\\s\\S]*?\\.eq\\("is_active", true\\)`,
      ),
    );
  }
  assert.match(setupLoaderSource, /expenseItemsError:\s*expensesResult\.error/);
  assert.match(setupLoaderSource, /activeExpenseCategoryErrors:/);
  assert.match(setupLoaderSource, /activeExpenseCategoryCounts/);
});

test("B07 Tasks 2-3 group existing rows and expose explicit none only for zero-active categories", () => {
  assert.match(setupShellSource, /ExpenseSetupContent/);
  assert.match(
    setupExpenseSource,
    /expenseItems\.filter\([\s\S]*expense\.category === category\.value/,
  );
  assert.match(setupExpenseSource, /const canDeclareNone = activeCount === 0/);
  assert.match(setupExpenseSource, /ليس لدي مصروف من هذا النوع/);
  assert.match(setupExpenseSource, /type="checkbox"/);
  assert.match(setupExpenseSource, /useState<Record<ExpenseCategory, boolean>>/);
  assert.match(setupExpenseSource, /غير نشط/);
});

test("B07 Task 4 reuses the existing drawer with a fixed canonical category and keeps B08 behavior unchanged", () => {
  assert.match(setupExpenseSource, /ExpenseDrawerLauncher/);
  assert.match(setupExpenseSource, /destination="setup"/);
  assert.match(setupExpenseSource, /fixedCategory=\{category\.value\}/);
  assert.match(expenseDrawerSource, /name="category" value=\{fixedCategory\}/);
  assert.match(expenseDrawerSource, /name="cost_behavior"/);
  assert.match(expenseDrawerSource, /EXPENSE_COST_BEHAVIOR_OPTIONS|behaviorOptions/);
  assert.doesNotMatch(setupExpenseSource, /مبلغ ثابت تقريبًا|تزيد مع عدد العملاء|نسبة من الإيراد/);
});

test("B07 Task 5 allow-lists setup/workspace destinations while preserving workspace as default", () => {
  assert.match(expenseActionsSource, /type ExpenseMutationDestination = "workspace" \| "setup"/);
  assert.match(expenseActionsSource, /if \(values\.length === 0\) return "workspace"/);
  assert.match(
    expenseActionsSource,
    /values\[0\] === "workspace" \|\| values\[0\] === "setup"/,
  );
  assert.match(expenseActionsSource, /buildBusinessSetupHref\(businessId, "expenses"\)/);
  assert.match(expenseActionsSource, /destination === "setup"/);
  assert.match(expenseActionsSource, /redirectToExpenses\(businessId, status, returnOrigin\)/);
  assert.doesNotMatch(expenseActionsSource, /https?:\/\//);
});

test("B07 Tasks 1-5 do not add review persistence or a parallel expense model", () => {
  assert.doesNotMatch(setupExpenseSource, /expense_setup_reviewed_at/);
  assert.doesNotMatch(setupExpenseSource, /confirmExpense|reviewExpense|update\(/);
  assert.doesNotMatch(expenseActionsSource, /from\("setup_expense/);
});
