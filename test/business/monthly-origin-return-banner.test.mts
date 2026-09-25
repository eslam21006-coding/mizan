import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseMonthlyExternalReturnOrigin } from "../../src/lib/monthly-return-origin.ts";

const monthlyOriginSource = readFileSync("src/lib/monthly-return-origin.ts", "utf8");
const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const monthlyActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/actions.ts",
  "utf8",
);
const monthlySetupNavigationSource = readFileSync(
  "src/lib/monthly-setup-navigation.ts",
  "utf8",
);

/** Locks Monthly Return to known cross-module origins, including N50 Insights. */
test("Monthly accepts only external structured Return origins", () => {
  assert.match(monthlyOriginSource, /parsed\?\.origin === "customer-overview"/);
  assert.match(monthlyOriginSource, /parsed\?\.origin === "customer-profitability"/);
  assert.match(monthlyOriginSource, /parsed\?\.origin === "insights"/);
  assert.deepEqual(
    parseMonthlyExternalReturnOrigin({
      origin: "insights",
      month: "2026-09",
      insight_rule: "non_media_cost_pressure",
    }),
    {
      origin: "insights",
      month: "2026-09",
      ruleId: "non_media_cost_pressure",
    },
  );
  assert.equal(
    parseMonthlyExternalReturnOrigin({
      origin: "insights",
      month: "2026-09",
      insight_rule: "not-a-rule",
    }),
    null,
  );
  assert.match(
    monthlyPageSource,
    /parseMonthlyExternalReturnOrigin\(\{[\s\S]*origin: query\.origin,[\s\S]*month: query\.return_month \?\? query\.month,[\s\S]*insight_rule: query\.insight_rule/,
  );
  assert.match(monthlyPageSource, /ariaLabel="سياق العودة من الإدخال الشهري"/);
  assert.doesNotMatch(monthlyPageSource, /returnTo/);
});

/** Locks Monthly navigation, forms, and setup detours to the original Insights context. */
test("Monthly navigation and setup controls preserve Return context", () => {
  assert.match(monthlyPageSource, /function appendMonthlyReturnQuery/);
  assert.match(monthlyPageSource, /query\.set\("origin", returnOrigin\.origin\)/);
  assert.match(monthlyPageSource, /query\.set\("return_month", returnOrigin\.month\)/);
  assert.match(monthlyPageSource, /query\.set\("insight_rule", returnOrigin\.ruleId\)/);
  assert.match(monthlyPageSource, /buildMonthlySetupHref/);
  assert.match(
    monthlySetupNavigationSource,
    /query\.set\("upstream_origin", returnOrigin\.origin\)/,
  );
  assert.match(
    monthlySetupNavigationSource,
    /query\.set\("upstream_insight_rule", returnOrigin\.ruleId\)/,
  );
  assert.match(monthlyPageSource, /href=\{monthlyHref\(previousMonth\)\}/);
  assert.match(monthlyPageSource, /href=\{monthlyHref\(nextMonth\)\}/);
  assert.match(monthlyPageSource, /<MonthlyReturnOriginFields returnOrigin=\{returnOrigin\} \/>/);
  assert.match(monthlyPageSource, /returnOrigin=\{returnOrigin\}/);
});

/** Locks save/copy redirects to the same validated origin and source Return month. */
test("Monthly actions preserve safe Return context across save and copy outcomes", () => {
  assert.match(monthlyActionsSource, /formData\.getAll\("origin"\)/);
  assert.match(monthlyActionsSource, /formData\.getAll\("return_month"\)/);
  assert.match(monthlyActionsSource, /formData\.getAll\("insight_rule"\)/);
  assert.match(monthlyActionsSource, /formData\.getAll\("insight_subject"\)/);
  assert.match(monthlyActionsSource, /insightRules\.length > 1/);
  assert.match(
    monthlyActionsSource,
    /parseMonthlyExternalReturnOrigin\(\{[\s\S]*origin: rawOrigin,[\s\S]*month: rawMonth,[\s\S]*insight_rule: rawInsightRule/,
  );
  assert.match(monthlyActionsSource, /query\.set\("insight_rule", returnOrigin\.ruleId\)/);
  assert.match(
    monthlyActionsSource,
    /redirectMonthly\(businessId, month\.monthKey, "saved", returnOrigin\)/,
  );
  assert.match(
    monthlyActionsSource,
    /redirectMonthly\(businessId, month\.monthKey, "save-failed", returnOrigin\)/,
  );
  assert.match(
    monthlyActionsSource,
    /redirectMonthly\(businessId, month\.monthKey, "copy-failed", returnOrigin\)/,
  );
  assert.match(
    monthlyActionsSource,
    /redirectMonthly\(businessId, month\.monthKey, "no-previous", returnOrigin\)/,
  );
  assert.match(
    monthlyActionsSource,
    /redirectHistoricalCorrection\(businessId, month\.monthKey, returnOrigin\)/,
  );
  assert.doesNotMatch(monthlyActionsSource, /returnTo/);
});
