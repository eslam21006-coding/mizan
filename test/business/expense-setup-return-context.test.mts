import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const monthlySource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const expensePageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/expenses/page.tsx",
  "utf8",
);
const expenseActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/expenses/actions.ts",
  "utf8",
);

test("N27 Monthly opens Expenses with the selected month as structured origin", () => {
  assert.match(
    monthlySource,
    /expenses\?\$\{new URLSearchParams\(\{[\s\S]*origin: "monthly-editor",[\s\S]*month: selectedMonth\.monthKey/,
  );
  assert.doesNotMatch(monthlySource, /returnTo/);
});

test("N27 Expenses renders and submits the safe Monthly return context", () => {
  assert.match(
    expensePageSource,
    /parseSetupReturnOrigin\(\{[\s\S]*origin: query\.origin,[\s\S]*month: query\.month/,
  );
  assert.match(expensePageSource, /ariaLabel="سياق العودة من إعداد المصروفات"/);
  assert.match(expensePageSource, /returnLabel="العودة إلى الإدخال الشهري"/);
  assert.match(expensePageSource, /name="origin" value=\{returnOrigin\.origin\}/);
  assert.match(expensePageSource, /name="month" value=\{returnOrigin\.month\}/);
  assert.doesNotMatch(expensePageSource, /returnTo/);
});

test("N27 Expenses actions reject ambiguous metadata and preserve safe context", () => {
  assert.match(expenseActionsSource, /formData\.getAll\("origin"\)/);
  assert.match(expenseActionsSource, /formData\.getAll\("month"\)/);
  assert.match(
    expenseActionsSource,
    /origins\.length !== 1 \|\| months\.length !== 1/,
  );
  assert.match(
    expenseActionsSource,
    /parseSetupReturnOrigin\(\{ origin, month \}\)/,
  );
  assert.match(expenseActionsSource, /query\.set\("origin", returnOrigin\.origin\)/);
  assert.match(expenseActionsSource, /query\.set\("month", returnOrigin\.month\)/);
  assert.match(
    expenseActionsSource,
    /redirectToExpenses\(businessId, "created", returnOrigin\)/,
  );
  assert.match(
    expenseActionsSource,
    /redirectToExpenses\(businessId, "updated", returnOrigin\)/,
  );
  assert.match(
    expenseActionsSource,
    /redirectToExpenses\(businessId, "deleted", returnOrigin\)/,
  );
  assert.match(
    expenseActionsSource,
    /expensesPath\(businessId, "create-failed", returnOrigin\)/,
  );
  assert.match(
    expenseActionsSource,
    /expensesPath\(businessId, "update-failed", returnOrigin\)/,
  );
  assert.match(
    expenseActionsSource,
    /expensesPath\(businessId, "delete-failed", returnOrigin\)/,
  );
  assert.doesNotMatch(expenseActionsSource, /returnTo/);
});
