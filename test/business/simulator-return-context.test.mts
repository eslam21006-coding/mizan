import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSimulatorHref,
  buildTargetPlannerReturnHref,
  parseSimulatorTargetPlannerReturnContext,
} from "../../src/lib/simulator-return-context.ts";

const PLANNER_BUSINESS_ID = "123e4567-e89b-42d3-a456-426614174000";
const SIMULATOR_BUSINESS_ID = "123e4567-e89b-42d3-a456-426614174001";

test("parses only complete Target Planner Simulator return context", () => {
  assert.deepEqual(
    parseSimulatorTargetPlannerReturnContext({
      origin: "target-planner",
      planner_business: PLANNER_BUSINESS_ID,
      planner_step: "plan",
      planner_goal: "net_profit",
      planner_value: "50000",
    }),
    {
      origin: "target-planner",
      plannerBusinessId: PLANNER_BUSINESS_ID,
      step: "plan",
      goal: "net_profit",
      value: "50000",
    },
  );

  assert.equal(
    parseSimulatorTargetPlannerReturnContext({
      origin: "target-planner",
      planner_step: "plan",
      planner_goal: "net_profit",
    }),
    null,
  );
  assert.equal(
    parseSimulatorTargetPlannerReturnContext({
      origin: "target-planner",
      planner_business: "not-a-business-id",
      planner_step: "plan",
      planner_goal: "net_profit",
    }),
    null,
  );
  assert.equal(
    parseSimulatorTargetPlannerReturnContext({
      origin: "insights",
      planner_business: PLANNER_BUSINESS_ID,
      planner_step: "plan",
      planner_goal: "net_profit",
    }),
    null,
  );
});

test("rejects duplicated planner business and planner workflow fields", () => {
  const duplicatedBusiness = new URLSearchParams({
    origin: "target-planner",
    planner_step: "plan",
    planner_goal: "revenue",
  });
  duplicatedBusiness.append("planner_business", PLANNER_BUSINESS_ID);
  duplicatedBusiness.append("planner_business", SIMULATOR_BUSINESS_ID);
  assert.equal(parseSimulatorTargetPlannerReturnContext(duplicatedBusiness), null);

  const duplicatedStep = new URLSearchParams({
    origin: "target-planner",
    planner_business: PLANNER_BUSINESS_ID,
    planner_goal: "revenue",
  });
  duplicatedStep.append("planner_step", "plan");
  duplicatedStep.append("planner_step", "goal");
  assert.equal(parseSimulatorTargetPlannerReturnContext(duplicatedStep), null);
});

test("builds canonical Simulator links with exact structured return context", () => {
  const href = buildSimulatorHref({
    businessId: SIMULATOR_BUSINESS_ID,
    month: "2026-08",
    scenarioId: "scenario-a",
    status: "saved",
    returnContext: {
      origin: "target-planner",
      plannerBusinessId: PLANNER_BUSINESS_ID,
      step: "plan",
      goal: "net_profit_margin",
      value: "35.5",
    },
  });
  const url = new URL(href, "https://mizan.test");

  assert.equal(url.pathname, "/simulator");
  assert.equal(url.searchParams.get("business"), SIMULATOR_BUSINESS_ID);
  assert.equal(url.searchParams.get("month"), "2026-08");
  assert.equal(url.searchParams.get("scenario"), "scenario-a");
  assert.equal(url.searchParams.get("status"), "saved");
  assert.equal(url.searchParams.get("origin"), "target-planner");
  assert.equal(url.searchParams.get("planner_business"), PLANNER_BUSINESS_ID);
  assert.equal(url.searchParams.get("planner_step"), "plan");
  assert.equal(url.searchParams.get("planner_goal"), "net_profit_margin");
  assert.equal(url.searchParams.get("planner_value"), "35.5");
  assert.equal(url.searchParams.has("returnTo"), false);
  assert.equal([...url.searchParams.keys()].length, 9);
});

test("returns to the original planner business even if Simulator business changes", () => {
  const context = parseSimulatorTargetPlannerReturnContext({
    origin: "target-planner",
    planner_business: PLANNER_BUSINESS_ID,
    planner_step: "assumptions",
    planner_goal: "revenue",
    planner_value: "75000",
    returnTo: "https://evil.example/steal",
  });
  assert.ok(context);

  assert.equal(
    buildTargetPlannerReturnHref(context),
    `/target-plan?business=${PLANNER_BUSINESS_ID}&goal=revenue&step=assumptions&value=75000`,
  );
});
