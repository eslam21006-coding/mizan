import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const decisionLoader = fs.readFileSync("src/lib/business/decision-dashboard.ts", "utf8");
const targetPlannerActuals = fs.readFileSync("src/lib/business/target-planner-actuals.ts", "utf8");
const scenarioEngine = fs.readFileSync("src/lib/business/scenario-engine.ts", "utf8");

test("Decision Engine uses only as-of-month Customer Economics observations", () => {
  assert.match(decisionLoader, /customer_lifetime_contribution_profit_observations/);
  assert.match(decisionLoader, /\.eq\("observation_month", currentMonthStart\)/);
  assert.doesNotMatch(decisionLoader, /customer_lifetime_contribution_profit_display/);
});

test("Target Planner remains based on authoritative monthly business actuals rather than realized lifetime history", () => {
  assert.match(targetPlannerActuals, /core\.netCashCollected/);
  assert.match(targetPlannerActuals, /core\.newCustomers/);
  assert.match(targetPlannerActuals, /core\.expensesByItem/);
  assert.doesNotMatch(targetPlannerActuals, /customer_lifetime_contribution_profit/i);
  assert.doesNotMatch(targetPlannerActuals, /observed[_A-Z]?ltv/i);
  assert.doesNotMatch(targetPlannerActuals, /customer-economics/i);
});

test("Simulator keeps monthly customer value separate from Observed LTV and Lifetime Contribution Profit", () => {
  assert.match(
    scenarioEngine,
    /customerValue:\s*divideRationals\(netCash,\s*\{[\s\S]*?BigInt\(newCustomers\)/,
  );
  assert.match(scenarioEngine, /Scenario changes|hypothetical monthly scenario/i);
  assert.doesNotMatch(scenarioEngine, /customer_lifetime_contribution_profit/i);
  assert.doesNotMatch(scenarioEngine, /observed[_A-Z]?ltv/i);
  assert.doesNotMatch(scenarioEngine, /lifetimeContributionProfit/);
});
