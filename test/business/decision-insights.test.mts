import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCoreFinancials,
  type CoreCalculationInput,
} from "../../src/lib/business/calculations.ts";
import {
  buildDataQualityProfile,
} from "../../src/lib/business/data-quality.ts";
import {
  generateRuleBasedInsights,
  type DecisionFunnelInput,
} from "../../src/lib/business/decision-insights.ts";
import {
  calculateFunnelMetrics,
  reconcileBusinessAdSpend,
} from "../../src/lib/business/funnel-calculations.ts";

function coreInput({
  gross = "1000",
  refunds = "0",
  acquisitionCost = "200",
  otherCost = "0",
  adSpend = "100",
  newCustomers = 10,
}: {
  gross?: string;
  refunds?: string;
  acquisitionCost?: string;
  otherCost?: string;
  adSpend?: string;
  newCustomers?: number;
} = {}): CoreCalculationInput {
  return {
    revenueStreams: [
      {
        id: "offer",
        name: "Offer",
        streamType: "front_end",
        grossCashCollected: gross,
        refunds,
      },
    ],
    expenses: [
      {
        id: "acquisition",
        name: "Acquisition",
        category: "acquisition",
        behavior: "fixed_monthly",
        inputValue: acquisitionCost,
      },
      {
        id: "overhead",
        name: "Overhead",
        category: "overhead",
        behavior: "fixed_monthly",
        inputValue: otherCost,
      },
    ],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers,
    totalPayingCustomers: newCustomers,
    canonicalAdSpend: adSpend,
    attributedRevenue: null,
  };
}

function funnel({
  id,
  showed,
  booked = 100,
  qualified = 40,
  sales,
}: {
  id: string;
  showed: number;
  booked?: number;
  qualified?: number;
  sales: number;
}): DecisionFunnelInput {
  return {
    id,
    name: `Funnel ${id}`,
    metrics: calculateFunnelMetrics({
      adSpend: "100",
      leads: 200,
      bookedCalls: booked,
      showedCalls: showed,
      qualifiedCalls: qualified,
      sales,
      newCustomers: 10,
      cashCollected: "1000",
      attributedRevenue: null,
    }),
  };
}

function buildDecisionInput({
  current = calculateCoreFinancials(coreInput()),
  previous = calculateCoreFinancials(coreInput()),
  funnels = [] as DecisionFunnelInput[],
  lifetimeContributionProfit,
  adSpendReconciliation = reconcileBusinessAdSpend("100", ["100"]),
}: {
  current?: ReturnType<typeof calculateCoreFinancials>;
  previous?: ReturnType<typeof calculateCoreFinancials>;
  funnels?: DecisionFunnelInput[];
  lifetimeContributionProfit?: string;
  adSpendReconciliation?: ReturnType<typeof reconcileBusinessAdSpend>;
} = {}) {
  const customerEconomics = lifetimeContributionProfit === undefined
    ? undefined
    : { lifetimeContributionProfit: { state: "ready" as const } };

  const dataQuality = buildDataQualityProfile({
    currentBusiness: current,
    previousBusiness: previous,
    adSpendReconciliation,
    funnels,
    ...(customerEconomics ? { customerEconomics } : {}),
  });

  return {
    currentBusiness: current,
    previousBusiness: previous,
    dataQuality,
    funnels,
    ...(lifetimeContributionProfit === undefined
      ? {}
      : { customerEconomics: { lifetimeContributionProfit } }),
  };
}

function hasRule(result: ReturnType<typeof generateRuleBasedInsights>, ruleId: string) {
  return result.candidates.some((candidate) => candidate.ruleId === ruleId);
}

test("Task 27 identifies attendance as the likely bottleneck only below 65% show and above 20% close", () => {
  const weakAttendance = funnel({ id: "weak-attendance", showed: 64, qualified: 40, sales: 9 });
  const result = generateRuleBasedInsights(buildDecisionInput({ funnels: [weakAttendance] }));

  assert.equal(hasRule(result, "funnel_attendance_bottleneck"), true);
  const insight = result.candidates.find((candidate) => candidate.ruleId === "funnel_attendance_bottleneck");
  assert.match(insight?.messageAr ?? "", /أقل من 65%/);
  assert.match(insight?.messageAr ?? "", /أعلى من 20%/);
});

test("Task 27 does not trigger attendance bottleneck at the exact 65% or 20% boundaries", () => {
  const exactShowBoundary = funnel({ id: "show-65", showed: 65, qualified: 40, sales: 9 });
  const exactCloseBoundary = funnel({ id: "close-20", showed: 64, qualified: 40, sales: 8 });
  const result = generateRuleBasedInsights(
    buildDecisionInput({ funnels: [exactShowBoundary, exactCloseBoundary] }),
  );

  assert.equal(hasRule(result, "funnel_attendance_bottleneck"), false);
  const attendanceEvaluations = result.evaluations.filter(
    (evaluation) => evaluation.ruleId === "funnel_attendance_bottleneck",
  );
  assert.equal(attendanceEvaluations.length, 2);
  assert.ok(attendanceEvaluations.every((evaluation) => evaluation.status === "not_matched"));
});

test("Task 27 flags unhealthy growth when Net Cash rises while Real Net Profit falls", () => {
  const previous = calculateCoreFinancials(
    coreInput({ gross: "1000", acquisitionCost: "200", otherCost: "300" }),
  );
  const current = calculateCoreFinancials(
    coreInput({ gross: "1200", acquisitionCost: "200", otherCost: "750" }),
  );

  const result = generateRuleBasedInsights(buildDecisionInput({ current, previous }));

  assert.equal(hasRule(result, "unhealthy_growth"), true);
  const insight = result.candidates.find((candidate) => candidate.ruleId === "unhealthy_growth");
  assert.deepEqual(insight?.evidence, ["net_cash_collected:up", "real_net_profit:down"]);
});

test("Task 27 detects non-media cost pressure only when Media CAC is exactly flat and Ultimate CAC rises", () => {
  const previous = calculateCoreFinancials(
    coreInput({ acquisitionCost: "200", otherCost: "0", adSpend: "100" }),
  );
  const current = calculateCoreFinancials(
    coreInput({ acquisitionCost: "200", otherCost: "100", adSpend: "100" }),
  );

  const exactFlat = generateRuleBasedInsights(buildDecisionInput({ current, previous }));
  assert.equal(hasRule(exactFlat, "non_media_cost_pressure"), true);

  const changedMediaCacCurrent = calculateCoreFinancials(
    coreInput({ acquisitionCost: "200", otherCost: "100", adSpend: "101" }),
  );
  const changedMedia = generateRuleBasedInsights(
    buildDecisionInput({ current: changedMediaCacCurrent, previous }),
  );
  assert.equal(hasRule(changedMedia, "non_media_cost_pressure"), false);
});

test("Task 27 blocks non-media cost conclusions when business and funnel ad spend conflict", () => {
  const previous = calculateCoreFinancials(coreInput({ acquisitionCost: "200", adSpend: "100" }));
  const current = calculateCoreFinancials(
    coreInput({ acquisitionCost: "200", otherCost: "100", adSpend: "100" }),
  );
  const result = generateRuleBasedInsights(
    buildDecisionInput({
      current,
      previous,
      adSpendReconciliation: reconcileBusinessAdSpend("100", ["80"]),
    }),
  );

  assert.equal(hasRule(result, "non_media_cost_pressure"), false);
  const evaluation = result.evaluations.find(
    (entry) => entry.ruleId === "non_media_cost_pressure",
  );
  assert.equal(evaluation?.status, "insufficient");
  assert.ok(
    evaluation?.blockers.some(
      (blocker) => blocker.reasonCode === "AD_SPEND_RECONCILIATION_MISMATCH",
    ),
  );
});

test("Task 27 contextualizes rising Ultimate CAC when Lifetime Contribution Profit remains positive", () => {
  const previous = calculateCoreFinancials(coreInput({ acquisitionCost: "200", otherCost: "0" }));
  const current = calculateCoreFinancials(coreInput({ acquisitionCost: "200", otherCost: "100" }));
  const result = generateRuleBasedInsights(
    buildDecisionInput({ current, previous, lifetimeContributionProfit: "250.50" }),
  );

  assert.equal(hasRule(result, "rising_cac_lifetime_supported"), true);
  const insight = result.candidates.find(
    (candidate) => candidate.ruleId === "rising_cac_lifetime_supported",
  );
  assert.equal(insight?.severity, "context");
  assert.match(insight?.messageAr ?? "", /لا تصنف الاستحواذ/);
});

test("Task 27 flags weak lifetime economics when a funnel is above both healthy conversion benchmarks", () => {
  const healthyFunnel = funnel({ id: "healthy", showed: 70, qualified: 40, sales: 9 });
  const result = generateRuleBasedInsights(
    buildDecisionInput({ funnels: [healthyFunnel], lifetimeContributionProfit: "-25" }),
  );

  assert.equal(hasRule(result, "healthy_funnel_weak_lifetime"), true);
  const insight = result.candidates.find(
    (candidate) => candidate.ruleId === "healthy_funnel_weak_lifetime",
  );
  assert.equal(insight?.severity, "critical");
  assert.match(insight?.messageAr ?? "", /ربح المساهمة مدى الحياة سلبي/);
});

test("Task 27 returns the insufficient-data fallback instead of inventing conclusions", () => {
  const current = calculateCoreFinancials(coreInput());
  const dataQuality = buildDataQualityProfile({
    currentBusiness: current,
    previousBusiness: null,
  });

  const result = generateRuleBasedInsights({
    currentBusiness: current,
    previousBusiness: null,
    dataQuality,
  });

  assert.equal(result.candidates.length, 0);
  assert.equal(result.fallbackMessageAr, "البيانات غير كافية للحكم");
  assert.ok(result.evaluations.some((evaluation) => evaluation.status === "insufficient"));
});
