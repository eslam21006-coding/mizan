import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveNavigationDestination } from "../../src/lib/navigation-hierarchy.ts";
import { buildMonthlySetupHref } from "../../src/lib/monthly-setup-navigation.ts";
import { parseSetupReturnOrigin } from "../../src/lib/setup-return-origin.ts";
import { resolveReturnOrigin } from "../../src/lib/return-origin.ts";

const setupOriginSource = readFileSync("src/lib/setup-return-origin.ts", "utf8");
const monthlySource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const monthlySetupNavigationSource = readFileSync(
  "src/lib/monthly-setup-navigation.ts",
  "utf8",
);
const revenuePageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/revenue-streams/page.tsx",
  "utf8",
);
const revenueDrawerSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/revenue-streams/revenue-stream-drawer.tsx",
  "utf8",
);
const revenueActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/revenue-streams/actions.ts",
  "utf8",
);

test("setup parser accepts validated customer or Insights upstream metadata only", () => {
  assert.match(setupOriginSource, /upstream\.origin !== "customer-overview"/);
  assert.match(setupOriginSource, /upstream\.origin !== "customer-profitability"/);
  assert.match(setupOriginSource, /upstream\.origin !== "insights"/);
  assert.doesNotMatch(setupOriginSource, /returnTo/);

  assert.deepEqual(
    parseSetupReturnOrigin({
      origin: "monthly-editor",
      month: "2026-10",
      upstream_origin: "insights",
      upstream_month: "2026-09",
      upstream_insight_rule: "non_media_cost_pressure",
    }),
    {
      origin: "monthly-editor",
      month: "2026-10",
      upstream: {
        origin: "insights",
        month: "2026-09",
        ruleId: "non_media_cost_pressure",
      },
    },
  );

  assert.equal(
    parseSetupReturnOrigin({
      origin: "monthly-editor",
      month: "2026-10",
      upstream_origin: "insights",
      upstream_month: "2026-09",
      upstream_insight_rule: "not-a-rule",
    }),
    null,
  );
});

test("typed setup return restores Monthly with the exact originating insight", () => {
  const origin = parseSetupReturnOrigin({
    origin: "monthly-editor",
    month: "2026-10",
    upstream_origin: "insights",
    upstream_month: "2026-09",
    upstream_insight_rule: "non_media_cost_pressure",
  });
  assert.ok(origin);

  assert.equal(
    resolveNavigationDestination(
      resolveReturnOrigin(origin, {
        businessId: "123e4567-e89b-42d3-a456-426614174000",
      }),
    ),
    "/businesses/123e4567-e89b-42d3-a456-426614174000/monthly?month=2026-10&origin=insights&return_month=2026-09&insight_rule=non_media_cost_pressure",
  );
});

test("Monthly setup URLs carry nested Insights metadata through the shared builder", () => {
  assert.match(monthlySource, /buildMonthlySetupHref/);
  assert.match(monthlySetupNavigationSource, /query\.set\("upstream_origin", returnOrigin\.origin\)/);
  assert.match(monthlySetupNavigationSource, /query\.set\("upstream_month", returnOrigin\.month\)/);
  assert.match(monthlySetupNavigationSource, /query\.set\("upstream_insight_rule", returnOrigin\.ruleId\)/);

  assert.equal(
    buildMonthlySetupHref(
      "123e4567-e89b-42d3-a456-426614174000",
      "revenue-streams",
      "2026-10",
      {
        origin: "insights",
        month: "2026-09",
        ruleId: "non_media_cost_pressure",
      },
    ),
    "/businesses/123e4567-e89b-42d3-a456-426614174000/revenue-streams?origin=monthly-editor&month=2026-10&upstream_origin=insights&upstream_month=2026-09&upstream_insight_rule=non_media_cost_pressure",
  );
});

test("Revenue Sources page and drawer submit the full nested Insights context", () => {
  assert.match(revenuePageSource, /upstream_insight_rule: query\.upstream_insight_rule/);
  assert.match(revenuePageSource, /upstream_insight_subject: query\.upstream_insight_subject/);
  assert.match(revenuePageSource, /ariaLabel="سياق العودة من إعداد مصادر الإيراد"/);
  assert.match(revenueDrawerSource, /name="upstream_insight_rule"/);
  assert.match(revenueDrawerSource, /value=\{returnOrigin\.upstream\.ruleId\}/);
  assert.match(revenueDrawerSource, /name="upstream_insight_subject"/);
  assert.doesNotMatch(revenuePageSource, /returnTo/);
});

test("Revenue Sources mutations reject ambiguity and preserve nested Insights metadata", () => {
  assert.match(revenueActionsSource, /formData\.getAll\("upstream_insight_rule"\)/);
  assert.match(revenueActionsSource, /formData\.getAll\("upstream_insight_subject"\)/);
  assert.match(revenueActionsSource, /upstreamInsightRules\.length > 1/);
  assert.match(revenueActionsSource, /upstreamInsightSubjects\.length > 1/);
  assert.match(revenueActionsSource, /query\.set\("upstream_insight_rule", returnOrigin\.upstream\.ruleId\)/);
  assert.match(revenueActionsSource, /revalidatePath\("\/insights"\)/);
  assert.doesNotMatch(revenueActionsSource, /returnTo/);
});
