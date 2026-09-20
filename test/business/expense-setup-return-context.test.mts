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

test("N27 Monthly opens Expenses through the same nested structured setup contract", () => {
  assert.match(monthlySource, /const setupHref = \(route: "revenue-streams" \| "expenses"\) =>/);
  assert.match(monthlySource, /href=\{setupHref\("expenses"\)\}/);
  assert.match(monthlySource, /queryParams\.set\("upstream_origin", returnOrigin\.origin\)/);
  assert.match(
    monthlySource,
    /queryParams\.set\("upstream_month", returnOrigin\.month\)/,
  );
  assert.doesNotMatch(monthlySource, /returnTo/);
});

test("N27 Expenses renders and submits the complete safe Monthly return context", () => {
  assert.match(
    expensePageSource,
    /parseSetupReturnOrigin\(\{[\s\S]*origin: query\.origin,[\s\S]*month: query\.month,[\s\S]*upstream_origin: query\.upstream_origin,[\s\S]*upstream_month: query\.upstream_month/,
  );
  assert.match(expensePageSource, /ariaLabel="سياق العودة من إعداد المصروفات"/);
  assert.match(expensePageSource, /returnLabel="العودة إلى الإدخال الشهري"/);
  assert.match(expensePageSource, /name="origin" value=\{returnOrigin\.origin\}/);
  assert.match(expensePageSource, /name="month" value=\{returnOrigin\.month\}/);
  assert.match(expensePageSource, /name="upstream_origin"/);
  assert.match(expensePageSource, /value=\{returnOrigin\.upstream\.origin\}/);
  assert.match(expensePageSource, /name="upstream_month"/);
  assert.match(expensePageSource, /value=\{returnOrigin\.upstream\.month\}/);
  assert.doesNotMatch(expensePageSource, /returnTo/);
});

test("N27 Expenses actions reject ambiguous nested metadata and preserve it on redirects", () => {
  assert.match(expenseActionsSource, /formData\.getAll\("origin"\)/);
  assert.match(expenseActionsSource, /formData\.getAll\("month"\)/);
  assert.match(expenseActionsSource, /formData\.getAll\("upstream_origin"\)/);
  assert.match(expenseActionsSource, /formData\.getAll\("upstream_month"\)/);
  assert.match(expenseActionsSource, /upstreamOrigins\.length > 1/);
  assert.match(expenseActionsSource, /upstreamMonths\.length > 1/);
  assert.match(
    expenseActionsSource,
    /parseSetupReturnOrigin\(\{[\s\S]*upstream_origin: upstreamOrigin,[\s\S]*upstream_month: upstreamMonth/,
  );
  assert.match(expenseActionsSource, /query\.set\("origin", returnOrigin\.origin\)/);
  assert.match(expenseActionsSource, /query\.set\("month", returnOrigin\.month\)/);
  assert.match(
    expenseActionsSource,
    /query\.set\("upstream_origin", returnOrigin\.upstream\.origin\)/,
  );
  assert.match(
    expenseActionsSource,
    /query\.set\("upstream_month", returnOrigin\.upstream\.month\)/,
  );
  assert.match(
    expenseActionsSource,
    /redirectToExpenses\(businessId, "created", returnOrigin\)/,
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
