import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseFunnelMonthlyReturnOrigin } from "../../src/lib/funnel-monthly-return-origin.ts";
import {
  buildHistoricalCorrectionSuccessHref,
  historicalCorrectionRevalidationPaths,
} from "../../src/lib/historical-correction-navigation.ts";
import { parseMonthlyExternalReturnOrigin } from "../../src/lib/monthly-return-origin.ts";
import { resolveNavigationDestination } from "../../src/lib/navigation-hierarchy.ts";
import { parseReturnOrigin, resolveReturnOrigin } from "../../src/lib/return-origin.ts";
import { parseSetupReturnOrigin } from "../../src/lib/setup-return-origin.ts";
import {
  buildTargetPlannerRepairHref,
  targetPlannerRepairSurfaceForBlocker,
} from "../../src/lib/target-planner-remediation.ts";

const targetPageSource = readFileSync("src/app/(app)/target-plan/page.tsx", "utf8");
const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const monthlyActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/actions.ts",
  "utf8",
);
const funnelPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/funnels/monthly/page.tsx",
  "utf8",
);
const funnelActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/funnels/monthly/actions.ts",
  "utf8",
);

/** Locks the structured Target Planner origin to allow-listed workflow state only. */
test("N54 parses and resolves an exact Target Planner return origin", () => {
  const origin = parseReturnOrigin({
    origin: "target-planner",
    planner_step: "assumptions",
    planner_goal: "net_profit",
    planner_value: "50000.25",
    returnTo: "https://evil.example/steal",
  });

  assert.deepEqual(origin, {
    origin: "target-planner",
    step: "assumptions",
    goal: "net_profit",
    value: "50000.25",
  });
  assert.ok(origin);
  assert.equal(
    resolveNavigationDestination(
      resolveReturnOrigin(origin, { businessId: "business fixture/01" }),
    ),
    "/target-plan?business=business+fixture%2F01&goal=net_profit&step=assumptions&value=50000.25",
  );
});

/** Target Planner metadata fails closed when required state is missing, unknown, malformed, or duplicated. */
test("N54 rejects malformed Target Planner return metadata", () => {
  for (const input of [
    { origin: "target-planner", planner_goal: "revenue" },
    { origin: "target-planner", planner_step: "plan" },
    { origin: "target-planner", planner_step: "unknown", planner_goal: "revenue" },
    { origin: "target-planner", planner_step: "plan", planner_goal: "unknown" },
    {
      origin: "target-planner",
      planner_step: "plan",
      planner_goal: "revenue",
      planner_value: "50000<script>",
    },
  ]) {
    assert.equal(parseReturnOrigin(input), null);
  }

  const duplicate = new URLSearchParams();
  duplicate.set("origin", "target-planner");
  duplicate.append("planner_step", "goal");
  duplicate.append("planner_step", "plan");
  duplicate.set("planner_goal", "revenue");
  assert.equal(parseReturnOrigin(duplicate), null);
});

/** Each known blocker points to the module that owns the evidence needed to fix it. */
test("N54 routes planner blockers and builds exact repair URLs", () => {
  for (const blocker of [
    "CORE_METRIC_UNAVAILABLE",
    "EXPENSE_AMOUNT_UNAVAILABLE",
    "MEDIA_EXCEEDS_FIXED_ACQUISITION",
  ] as const) {
    assert.equal(targetPlannerRepairSurfaceForBlocker(blocker), "monthly");
  }

  for (const blocker of [
    "AD_SPEND_UNAVAILABLE",
    "FUNNEL_DATA_UNAVAILABLE",
    "FUNNEL_CUSTOMER_MISMATCH",
    "FUNNEL_SEQUENCE_INVALID",
  ] as const) {
    assert.equal(targetPlannerRepairSurfaceForBlocker(blocker), "funnel-monthly");
  }

  const context = {
    businessId: "business fixture/01",
    month: "2026-07",
    step: "plan" as const,
    goal: "revenue" as const,
    value: "75000",
  };

  const monthlyUrl = new URL(
    buildTargetPlannerRepairHref(context, "monthly"),
    "https://mizan.test",
  );
  assert.equal(monthlyUrl.pathname, "/businesses/business%20fixture%2F01/monthly");
  assert.equal(monthlyUrl.searchParams.get("month"), "2026-07");
  assert.equal(monthlyUrl.searchParams.get("origin"), "target-planner");
  assert.equal(monthlyUrl.searchParams.get("planner_step"), "plan");
  assert.equal(monthlyUrl.searchParams.get("planner_goal"), "revenue");
  assert.equal(monthlyUrl.searchParams.get("planner_value"), "75000");

  const funnelUrl = new URL(
    buildTargetPlannerRepairHref(context, "funnel-monthly"),
    "https://mizan.test",
  );
  assert.equal(funnelUrl.pathname, "/businesses/business%20fixture%2F01/funnels/monthly");
  assert.equal(funnelUrl.searchParams.get("month"), "2026-07");
});

/** Monthly, Funnel Monthly, setup, and correction workflows all preserve the same planner origin. */
test("N54 preserves planner origin through repair workflows", () => {
  const metadata = {
    origin: "target-planner",
    planner_step: "assumptions",
    planner_goal: "net_profit_margin",
    planner_value: "35",
  } as const;

  assert.deepEqual(parseMonthlyExternalReturnOrigin(metadata), {
    origin: "target-planner",
    step: "assumptions",
    goal: "net_profit_margin",
    value: "35",
  });
  assert.deepEqual(parseFunnelMonthlyReturnOrigin(metadata), {
    origin: "target-planner",
    step: "assumptions",
    goal: "net_profit_margin",
    value: "35",
  });

  const setup = parseSetupReturnOrigin({
    origin: "monthly-editor",
    month: "2026-07",
    upstream_origin: "target-planner",
    upstream_planner_step: "assumptions",
    upstream_planner_goal: "net_profit_margin",
    upstream_planner_value: "35",
  });
  assert.deepEqual(setup, {
    origin: "monthly-editor",
    month: "2026-07",
    upstream: {
      origin: "target-planner",
      step: "assumptions",
      goal: "net_profit_margin",
      value: "35",
    },
  });
  assert.ok(setup);
  assert.equal(
    resolveNavigationDestination(
      resolveReturnOrigin(setup, { businessId: "business-a" }),
    ),
    "/businesses/business-a/monthly?month=2026-07&origin=target-planner&planner_step=assumptions&planner_goal=net_profit_margin&planner_value=35",
  );

  const correctionUrl = new URL(
    buildHistoricalCorrectionSuccessHref("business-a", "2026-07", {
      origin: "target-planner",
      step: "plan",
      goal: "revenue",
      value: "75000",
    }),
    "https://mizan.test",
  );
  assert.equal(correctionUrl.searchParams.get("origin"), "target-planner");
  assert.equal(correctionUrl.searchParams.get("planner_step"), "plan");
  assert.equal(correctionUrl.searchParams.get("planner_goal"), "revenue");
  assert.equal(correctionUrl.searchParams.get("planner_value"), "75000");
  assert.ok(historicalCorrectionRevalidationPaths("business-a").includes("/target-plan"));
});

/** Production repair pages and mutations carry planner metadata instead of arbitrary return URLs. */
test("N54 production UI and save paths preserve structured planner return fields", () => {
  assert.match(targetPageSource, /buildTargetPlannerRepairHref/);
  assert.match(targetPageSource, /issue\.repairSurface/);

  for (const source of [monthlyPageSource, funnelPageSource]) {
    assert.match(source, /planner_step/);
    assert.match(source, /planner_goal/);
    assert.match(source, /planner_value/);
    assert.match(source, /العودة إلى خطة الهدف/);
    assert.doesNotMatch(source, /returnTo/);
  }

  for (const source of [monthlyActionsSource, funnelActionsSource]) {
    assert.match(source, /formData\.getAll\("planner_step"\)/);
    assert.match(source, /formData\.getAll\("planner_goal"\)/);
    assert.match(source, /query\.set\("planner_step", returnOrigin\.step\)/);
    assert.match(source, /revalidatePath\("\/target-plan"\)/);
    assert.doesNotMatch(source, /returnTo/);
  }
});
