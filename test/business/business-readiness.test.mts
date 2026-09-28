import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  planningRequirementForSimulatorBlocker,
  planningRequirementForTargetPlannerBlocker,
  resolveBusinessReadiness,
  resolveCoreSetupReadiness,
  resolveCustomerReadiness,
  resolveHistoryReadiness,
  resolvePlanningCapabilityReadiness,
  resolveSalesReadiness,
} from "../../src/lib/business/readiness.ts";

const overviewResolverSource = await readFile(
  new URL("../../src/lib/business-overview.ts", import.meta.url),
  "utf8",
);

test("B01 core readiness distinguishes explicit reviewed-none from unknown expense setup", () => {
  const explicitlyReviewed = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup: "reviewed",
    validMonthCount: 1,
  });
  const unknown = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup: "unknown",
    validMonthCount: 1,
  });

  assert.equal(explicitlyReviewed.status, "ready");
  assert.deepEqual(explicitlyReviewed.missing, []);
  assert.equal(unknown.status, "incomplete");
  assert.deepEqual(unknown.missing, ["expense_setup_review"]);
});

test("B01 empty core setup reports deterministic missing requirements", () => {
  const readiness = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: false,
    revenueSourceCount: 0,
    expenseSetup: "not_reviewed",
    validMonthCount: 0,
  });

  assert.equal(readiness.status, "incomplete");
  assert.deepEqual(readiness.missing, [
    "business_identity",
    "revenue_setup",
    "expense_setup_review",
    "first_valid_month",
  ]);
});

test("B01 history keeps exact count while bucketing 0, 1, 2, and 3+ months", () => {
  const cases = [
    [0, "none"],
    [1, "one_month"],
    [2, "two_months"],
    [3, "three_plus"],
    [7, "three_plus"],
  ] as const;

  for (const [validMonthCount, level] of cases) {
    assert.deepEqual(resolveHistoryReadiness({ loadState: "loaded", validMonthCount }), {
      loadState: "loaded",
      validMonthCount,
      level,
    });
  }
});

test("B01 customer readiness maps existing transaction and review facts deterministically", () => {
  assert.deepEqual(
    resolveCustomerReadiness({
      loadState: "loaded",
      transactionCount: 0,
      reviewIssueCount: 0,
      analysisReady: false,
    }),
    {
      loadState: "loaded",
      status: "no_transactions",
      missing: ["transaction_history", "transaction_import"],
    },
  );

  assert.equal(
    resolveCustomerReadiness({
      loadState: "loaded",
      transactionCount: 3,
      reviewIssueCount: 0,
      analysisReady: false,
    }).status,
    "imported",
  );
  assert.equal(
    resolveCustomerReadiness({
      loadState: "loaded",
      transactionCount: 3,
      reviewIssueCount: 2,
      analysisReady: false,
    }).status,
    "needs_review",
  );
  assert.deepEqual(
    resolveCustomerReadiness({
      loadState: "loaded",
      transactionCount: 3,
      reviewIssueCount: 0,
      analysisReady: true,
    }),
    { loadState: "loaded", status: "ready", missing: [] },
  );
});

test("B01 sales readiness keeps funnels optional while reporting sales-analysis capability", () => {
  assert.deepEqual(
    resolveSalesReadiness({
      loadState: "loaded",
      funnelCount: 0,
      monthlyDataReady: false,
    }),
    {
      loadState: "loaded",
      status: "no_funnel",
      missing: ["funnel_configuration"],
    },
  );
  assert.equal(
    resolveSalesReadiness({
      loadState: "loaded",
      funnelCount: 1,
      monthlyDataReady: false,
    }).status,
    "funnel_configured",
  );
  assert.deepEqual(
    resolveSalesReadiness({
      loadState: "loaded",
      funnelCount: 2,
      monthlyDataReady: true,
    }),
    { loadState: "loaded", status: "monthly_data_ready", missing: [] },
  );
});

test("B01 planning readiness reuses existing Simulator and Target Planner blockers", () => {
  assert.equal(planningRequirementForSimulatorBlocker("MONTH_NOT_SAVED"), "monthly_actuals");
  assert.equal(
    planningRequirementForSimulatorBlocker("VARIABLE_COSTS_UNAVAILABLE"),
    "expense_actuals",
  );
  assert.equal(
    planningRequirementForSimulatorBlocker("NO_NEW_CUSTOMERS"),
    "positive_new_customers",
  );
  assert.equal(
    planningRequirementForSimulatorBlocker("AD_SPEND_UNAVAILABLE"),
    "ad_spend_actuals",
  );
  assert.equal(
    planningRequirementForTargetPlannerBlocker("FUNNEL_DATA_UNAVAILABLE"),
    "funnel_actuals",
  );
  assert.equal(
    planningRequirementForTargetPlannerBlocker("FUNNEL_CUSTOMER_MISMATCH"),
    "data_consistency",
  );

  assert.deepEqual(
    resolvePlanningCapabilityReadiness({
      loadState: "loaded",
      missingRequirements: ["monthly_actuals", "monthly_actuals", "ad_spend_actuals"],
    }),
    {
      loadState: "loaded",
      ready: false,
      missingRequirements: ["monthly_actuals", "ad_spend_actuals"],
    },
  );
  assert.deepEqual(
    resolvePlanningCapabilityReadiness({ loadState: "loaded", missingRequirements: [] }),
    { loadState: "loaded", ready: true, missingRequirements: [] },
  );
});

test("B01 optional customer, sales, and planning states never block Core Setup readiness", () => {
  const readiness = resolveBusinessReadiness({
    coreSetup: {
      loadState: "loaded",
      businessIdentityReady: true,
      revenueSourceCount: 1,
      expenseSetup: "reviewed",
      validMonthCount: 1,
    },
    history: { loadState: "loaded", validMonthCount: 1 },
    customers: {
      loadState: "loaded",
      transactionCount: 0,
      reviewIssueCount: 0,
      analysisReady: false,
    },
    sales: { loadState: "loaded", funnelCount: 0, monthlyDataReady: false },
    planning: {
      simulator: { loadState: "loaded", missingRequirements: ["ad_spend_actuals"] },
      targetPlanner: {
        loadState: "loaded",
        missingRequirements: ["rolling_3_months", "funnel_actuals"],
      },
    },
  });

  assert.equal(readiness.coreSetup.status, "ready");
  assert.equal(readiness.customers.status, "no_transactions");
  assert.equal(readiness.sales.status, "no_funnel");
  assert.equal(readiness.planning.simulator.ready, false);
  assert.equal(readiness.planning.targetPlanner.ready, false);
});

test("B01 load errors fail closed instead of being interpreted as known zero data", () => {
  assert.deepEqual(
    resolveCoreSetupReadiness({
      loadState: "load_error",
      businessIdentityReady: null,
      revenueSourceCount: null,
      expenseSetup: "unknown",
      validMonthCount: null,
    }),
    {
      loadState: "load_error",
      status: "incomplete",
      businessIdentityReady: false,
      revenueSetupReady: false,
      expenseSetup: "unknown",
      firstValidMonthReady: false,
      missing: [
        "business_identity",
        "revenue_setup",
        "expense_setup_review",
        "first_valid_month",
      ],
    },
  );
  assert.equal(
    resolvePlanningCapabilityReadiness({
      loadState: "load_error",
      missingRequirements: [],
    }).ready,
    false,
  );
});

test("B01 loaded count inputs reject invalid or unavailable values", () => {
  assert.throws(
    () => resolveHistoryReadiness({ loadState: "loaded", validMonthCount: -1 }),
    /non-negative safe integer/,
  );
  assert.throws(
    () =>
      resolveSalesReadiness({
        loadState: "loaded",
        funnelCount: null,
        monthlyDataReady: false,
      }),
    /must be available/,
  );
});

test("B01 readiness resolution is deterministic for identical input", () => {
  const input = {
    coreSetup: {
      loadState: "loaded" as const,
      businessIdentityReady: true,
      revenueSourceCount: 2,
      expenseSetup: "reviewed" as const,
      validMonthCount: 4,
    },
    history: { loadState: "loaded" as const, validMonthCount: 4 },
    customers: {
      loadState: "loaded" as const,
      transactionCount: 12,
      reviewIssueCount: 0,
      analysisReady: true,
    },
    sales: { loadState: "loaded" as const, funnelCount: 1, monthlyDataReady: true },
    planning: {
      simulator: { loadState: "loaded" as const, missingRequirements: [] },
      targetPlanner: { loadState: "loaded" as const, missingRequirements: [] },
    },
  };

  assert.deepEqual(resolveBusinessReadiness(input), resolveBusinessReadiness(input));
});

test("B01 current Overview delegates setup predicates to central readiness", () => {
  assert.match(overviewResolverSource, /resolveCoreSetupReadiness/);
  assert.doesNotMatch(
    overviewResolverSource,
    /const revenueSourcesReady\s*=\s*input\.revenueSourceCount\s*>\s*0/,
  );
});
