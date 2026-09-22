import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildFunnelModuleHref } from "../../src/lib/funnel-module.ts";
import { parseFunnelMonthlyReturnOrigin } from "../../src/lib/funnel-monthly-return-origin.ts";
import {
  parseReturnOrigin,
  resolveReturnOrigin,
} from "../../src/lib/return-origin.ts";
import { resolveNavigationDestination } from "../../src/lib/navigation-hierarchy.ts";

const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/funnels/monthly/page.tsx",
  "utf8",
);
const monthlyActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/funnels/monthly/actions.ts",
  "utf8",
);

test("Funnel Monthly accepts only Funnel Structure or validated Insights origins", () => {
  assert.deepEqual(
    parseFunnelMonthlyReturnOrigin({ origin: "funnel-structure" }),
    { origin: "funnel-structure" },
  );
  assert.deepEqual(
    parseFunnelMonthlyReturnOrigin({
      origin: "insights",
      month: "2026-09",
      insight_rule: "funnel_attendance_bottleneck",
      insight_subject: "123e4567-e89b-42d3-a456-426614174000",
    }),
    {
      origin: "insights",
      month: "2026-09",
      ruleId: "funnel_attendance_bottleneck",
      subjectId: "123e4567-e89b-42d3-a456-426614174000",
    },
  );
  assert.equal(parseFunnelMonthlyReturnOrigin({ origin: "customer-overview" }), null);
  assert.equal(parseFunnelMonthlyReturnOrigin({ origin: "https://evil.example" }), null);

  const duplicated = new URLSearchParams();
  duplicated.append("origin", "funnel-structure");
  duplicated.append("origin", "funnel-structure");
  assert.equal(parseFunnelMonthlyReturnOrigin(duplicated), null);
});

test("Funnel Structure Return remains deterministic", () => {
  const origin = parseReturnOrigin({
    origin: "funnel-structure",
    returnTo: "https://evil.example",
  });
  assert.deepEqual(origin, { origin: "funnel-structure" });
  assert.ok(origin);

  assert.equal(
    resolveNavigationDestination(
      resolveReturnOrigin(origin, { businessId: "business fixture/01" }),
    ),
    "/businesses/business%20fixture%2F01/funnels",
  );
});

test("Structure-to-Monthly local navigation remains isolated", () => {
  assert.equal(
    buildFunnelModuleHref(
      "business fixture/01",
      "monthly",
      "2026-09",
      "funnel-structure",
    ),
    "/businesses/business%20fixture%2F01/funnels/monthly?month=2026-09&origin=funnel-structure",
  );
  assert.equal(
    buildFunnelModuleHref(
      "business fixture/01",
      "liquidation",
      "2026-09",
      "funnel-structure",
    ),
    "/businesses/business%20fixture%2F01/liquidation?month=2026-09",
  );
});

test("Funnel Monthly UI preserves the exact originating insight", () => {
  assert.match(
    monthlyPageSource,
    /parseFunnelMonthlyReturnOrigin\(\{[\s\S]*origin: query\.origin,[\s\S]*month: query\.return_month \?\? query\.month,[\s\S]*insight_rule: query\.insight_rule/,
  );
  assert.match(monthlyPageSource, /returnOrigin\.origin === "insights"/);
  assert.match(monthlyPageSource, /name="return_month" value=\{returnOrigin\.month\}/);
  assert.match(monthlyPageSource, /name="insight_rule" value=\{returnOrigin\.ruleId\}/);
  assert.match(monthlyPageSource, /returnLabel=\{[\s\S]*"العودة إلى الملاحظة"/);
  assert.doesNotMatch(monthlyPageSource, /returnTo/);
});

test("Funnel Monthly saves preserve only validated return metadata", () => {
  assert.match(monthlyActionsSource, /formData\.getAll\("origin"\)/);
  assert.match(monthlyActionsSource, /formData\.getAll\("return_month"\)/);
  assert.match(monthlyActionsSource, /formData\.getAll\("insight_rule"\)/);
  assert.match(monthlyActionsSource, /insightRules\.length > 1/);
  assert.match(
    monthlyActionsSource,
    /parseFunnelMonthlyReturnOrigin\(\{[\s\S]*origin: origins\[0\],[\s\S]*month: returnMonth,[\s\S]*insight_rule: insightRule/,
  );
  assert.match(monthlyActionsSource, /query\.set\("insight_rule", returnOrigin\.ruleId\)/);
  assert.match(
    monthlyActionsSource,
    /redirectFunnelMonthly\(businessId, month\.monthKey, "saved", returnOrigin\)/,
  );
  assert.match(monthlyActionsSource, /revalidatePath\("\/insights"\)/);
  assert.doesNotMatch(monthlyActionsSource, /returnTo/);
});
