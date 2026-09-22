import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTargetPlannerStepHref,
  parseTargetPlannerStep,
} from "../../src/lib/target-planner-step.ts";

test("parses only allow-listed Target Planner steps", () => {
  assert.equal(parseTargetPlannerStep("goal"), "goal");
  assert.equal(parseTargetPlannerStep("assumptions"), "assumptions");
  assert.equal(parseTargetPlannerStep("plan"), "plan");
  assert.equal(parseTargetPlannerStep("unknown"), "goal");
  assert.equal(parseTargetPlannerStep(["plan", "goal"]), "goal");
  assert.equal(parseTargetPlannerStep(undefined), "goal");
});

test("builds canonical planner step links with exact workflow state", () => {
  const href = buildTargetPlannerStepHref(
    {
      businessId: "business fixture/01",
      goal: "net_profit",
      value: "50000",
    },
    "assumptions",
  );
  const url = new URL(href, "https://mizan.test");

  assert.equal(url.pathname, "/target-plan");
  assert.equal(url.searchParams.get("business"), "business fixture/01");
  assert.equal(url.searchParams.get("goal"), "net_profit");
  assert.equal(url.searchParams.get("value"), "50000");
  assert.equal(url.searchParams.get("step"), "assumptions");
  assert.equal([...url.searchParams.keys()].length, 4);
});

test("omits target value when the workflow has not captured one yet", () => {
  const href = buildTargetPlannerStepHref(
    {
      businessId: "business-a",
      goal: "revenue",
    },
    "goal",
  );
  const url = new URL(href, "https://mizan.test");

  assert.equal(url.searchParams.has("value"), false);
  assert.equal(url.searchParams.get("step"), "goal");
});
