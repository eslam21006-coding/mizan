import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMonthlySetupHref } from "../../src/lib/monthly-setup-navigation.ts";
import { parseSetupReturnOrigin } from "../../src/lib/setup-return-origin.ts";

const monthlySource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const monthlySetupNavigationSource = readFileSync(
  "src/lib/monthly-setup-navigation.ts",
  "utf8",
);
const expensePageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/expenses/page.tsx",
  "utf8",
);
const expenseDrawerSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/expenses/expense-drawer.tsx",
  "utf8",
);
const expenseActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/expenses/actions.ts",
  "utf8",
);

test("Monthly opens Expenses with nested Insights return context", () => {
  assert.match(monthlySource, /buildMonthlySetupHref/);
  assert.match(monthlySetupNavigationSource, /query\.set\("upstream_insight_rule", returnOrigin\.ruleId\)/);
  assert.equal(
    buildMonthlySetupHref(
      "123e4567-e89b-42d3-a456-426614174000",
      "expenses",
      "2026-10",
      {
        origin: "insights",
        month: "2026-09",
        ruleId: "unhealthy_growth",
      },
    ),
    "/businesses/123e4567-e89b-42d3-a456-426614174000/expenses?origin=monthly-editor&month=2026-10&upstream_origin=insights&upstream_month=2026-09&upstream_insight_rule=unhealthy_growth",
  );

  assert.deepEqual(
    parseSetupReturnOrigin({
      origin: "monthly-editor",
      month: "2026-10",
      upstream_origin: "insights",
      upstream_month: "2026-09",
      upstream_insight_rule: "unhealthy_growth",
    }),
    {
      origin: "monthly-editor",
      month: "2026-10",
      upstream: {
        origin: "insights",
        month: "2026-09",
        ruleId: "unhealthy_growth",
      },
    },
  );
});

test("Expenses page and drawer submit the complete safe Monthly return context", () => {
  assert.match(expensePageSource, /upstream_insight_rule: query\.upstream_insight_rule/);
  assert.match(expensePageSource, /upstream_insight_subject: query\.upstream_insight_subject/);
  assert.match(expensePageSource, /ariaLabel="سياق العودة من إعداد المصروفات"/);
  assert.match(expenseDrawerSource, /name="upstream_insight_rule"/);
  assert.match(expenseDrawerSource, /value=\{returnOrigin\.upstream\.ruleId\}/);
  assert.match(expenseDrawerSource, /name="upstream_insight_subject"/);
  assert.doesNotMatch(expensePageSource, /returnTo/);
});

test("Expenses actions reject ambiguity and preserve nested Insights metadata", () => {
  assert.match(expenseActionsSource, /formData\.getAll\("upstream_insight_rule"\)/);
  assert.match(expenseActionsSource, /formData\.getAll\("upstream_insight_subject"\)/);
  assert.match(expenseActionsSource, /upstreamInsightRules\.length > 1/);
  assert.match(expenseActionsSource, /upstreamInsightSubjects\.length > 1/);
  assert.match(expenseActionsSource, /query\.set\("upstream_insight_rule", returnOrigin\.upstream\.ruleId\)/);
  assert.match(expenseActionsSource, /revalidatePath\("\/insights"\)/);
  assert.doesNotMatch(expenseActionsSource, /returnTo/);
});
