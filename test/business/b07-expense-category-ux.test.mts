import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_SETUP_CATEGORY_OPTIONS,
  resolveExpenseSetupReview,
} from "../../src/lib/business/expenses.ts";
import { executeExpenseSetupReviewConfirmation } from "../../src/lib/business/expense-setup-review.ts";

const setupPageSource = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/setup/page.tsx", import.meta.url),
  "utf8",
);
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
const setupActionsSource = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/setup/actions.ts",
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
  const examples = EXPENSE_SETUP_CATEGORY_OPTIONS.flatMap((option) => option.examples);
  assert.ok(examples.includes("Meta Ads"));
  assert.ok(examples.includes("Coach"));
  assert.ok(examples.includes("Software"));
  assert.ok(examples.includes("Payment processor fees"));
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
        `\\.eq\\("category", "${category}"\\)[\\s\\S]{0,120}\\.eq\\("is_active", true\\)`,
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
  assert.match(
    setupExpenseSource,
    /creationRequestId=\{creationRequestIds\[category\.value\]\}/,
  );
  assert.match(setupPageSource, /acquisition: randomUUID\(\)/);
  assert.match(setupPageSource, /fulfillment: randomUUID\(\)/);
  assert.match(setupPageSource, /overhead: randomUUID\(\)/);
  assert.match(setupPageSource, /financial: randomUUID\(\)/);
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
  assert.doesNotMatch(setupExpenseSource, /\.update\(|\.insert\(|\.upsert\(/);
  assert.doesNotMatch(expenseActionsSource, /from\("setup_expense/);
});


test("B07 Tasks 6-7 resolve known active/none combinations deterministically", () => {
  assert.deepEqual(
    resolveExpenseSetupReview(
      { acquisition: 0, fulfillment: 0, overhead: 0, financial: 0 },
      [],
    ),
    {
      resolved: false,
      unresolvedCategories: ["acquisition", "fulfillment", "overhead", "financial"],
      invalidNoneCategories: [],
    },
  );

  assert.deepEqual(
    resolveExpenseSetupReview(
      { acquisition: 0, fulfillment: 0, overhead: 0, financial: 0 },
      ["acquisition", "fulfillment", "overhead", "financial"],
    ),
    { resolved: true, unresolvedCategories: [], invalidNoneCategories: [] },
  );

  assert.deepEqual(
    resolveExpenseSetupReview(
      { acquisition: 1, fulfillment: 0, overhead: 2, financial: 0 },
      ["fulfillment", "financial"],
    ),
    { resolved: true, unresolvedCategories: [], invalidNoneCategories: [] },
  );

  assert.deepEqual(
    resolveExpenseSetupReview(
      { acquisition: 1, fulfillment: 0, overhead: 1, financial: 0 },
      ["fulfillment"],
    ),
    { resolved: false, unresolvedCategories: ["financial"], invalidNoneCategories: [] },
  );

  assert.deepEqual(
    resolveExpenseSetupReview(
      { acquisition: 1, fulfillment: 0, overhead: 1, financial: 0 },
      ["fulfillment", "financial"],
    ),
    { resolved: true, unresolvedCategories: [], invalidNoneCategories: [] },
  );
});

test("B07 Task 6 confirmation uses exact category counts and updates only review metadata", () => {
  assert.match(setupActionsSource, /requireAuthContext\(\)/);
  assert.match(
    setupActionsSource,
    /from\("expense_items"\)[\s\S]*select\("id", \{ count: "exact", head: true \}\)[\s\S]*eq\("category", category\)[\s\S]*eq\("is_active", true\)/,
  );
  assert.match(setupActionsSource, /executeExpenseSetupReviewConfirmation/);
  assert.match(
    setupActionsSource,
    /from\("businesses"\)[\s\S]*update\(\{ expense_setup_reviewed_at: reviewedAt \}\)/,
  );
  assert.doesNotMatch(setupActionsSource, /monthly_periods|monthly_expense_entries|historical/);
  assert.match(setupActionsSource, /result\.kind !== "reviewed"/);
  assert.match(setupActionsSource, /setupExpensesPath\(businessId, "reviewed"\)/);
});

test("B07 review boundary rejects explicit-none claims that contradict active expenses", async () => {
  let persisted = false;
  const activeCounts = {
    acquisition: 1,
    fulfillment: 0,
    overhead: 0,
    financial: 0,
  } as const;

  const result = await executeExpenseSetupReviewConfirmation(
    ["acquisition", "fulfillment", "overhead", "financial"],
    {
      countActiveExpenses: async (category) => ({
        count: activeCounts[category],
        error: null,
      }),
      persistReviewedAt: async () => {
        persisted = true;
        return { updated: true, error: null };
      },
    },
  );

  assert.deepEqual(result, { kind: "review-incomplete" });
  assert.equal(persisted, false);
});

test("B07 review boundary persists expense_setup_reviewed_at only after all categories resolve", async () => {
  const activeCounts = {
    acquisition: 1,
    fulfillment: 0,
    overhead: 2,
    financial: 0,
  } as const;
  const countedCategories: string[] = [];
  let persistedReviewedAt: string | null = null;

  const result = await executeExpenseSetupReviewConfirmation(
    ["fulfillment", "financial"],
    {
      countActiveExpenses: async (category) => {
        countedCategories.push(category);
        return { count: activeCounts[category], error: null };
      },
      persistReviewedAt: async (reviewedAt) => {
        persistedReviewedAt = reviewedAt;
        return { updated: true, error: null };
      },
      now: () => new Date("2026-09-30T20:00:00.000Z"),
    },
  );

  assert.deepEqual(result, { kind: "reviewed" });
  assert.deepEqual(countedCategories, EXPENSE_CATEGORIES);
  assert.equal(persistedReviewedAt, "2026-09-30T20:00:00.000Z");
});

test("B07 submission excludes stale none selections once a category gains active expenses", () => {
  assert.match(
    setupExpenseSource,
    /noneSelected\[category\.value\][\s\S]*activeExpenseCategoryCounts\[category\.value\] === 0/,
  );
});

test("B07 Task 8 shows reviewed-none only from canonical completed state", () => {
  assert.match(setupExpenseSource, /const reviewedNone = stepComplete && activeCount === 0/);
  assert.match(setupExpenseSource, /تمت المراجعة — لا يوجد مصروف من هذا النوع/);
  assert.match(setupExpenseSource, /reviewed:[\s\S]*تم تأكيد مراجعة المصروفات/);
});

test("B07 Task 9 stays on Expenses after review and relies on canonical readiness for Next", () => {
  assert.match(setupActionsSource, /buildBusinessSetupHref\(businessId, "expenses"\)/);
  assert.doesNotMatch(setupActionsSource, /buildBusinessSetupHref\(businessId, "month"\)/);
  assert.match(setupShellSource, /nextEnabled/);
});

test("B07 Task 10 hides expense mutations and review confirmation from read-only users", () => {
  assert.match(setupExpenseSource, /!canManage[\s\S]*يمكنك مراجعة المصروفات الحالية/);
  assert.match(setupExpenseSource, /canManage && creationRequestIds/);
  assert.match(setupExpenseSource, /canManage && canDeclareNone/);
  assert.match(setupExpenseSource, /canManage && !stepComplete/);
});
