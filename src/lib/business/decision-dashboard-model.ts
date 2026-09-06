import type { CoreCalculationResult } from "./calculations.ts";
import {
  buildDataQualityProfile,
  type ExternalDataQualitySignal,
} from "./data-quality.ts";
import {
  generateRuleBasedInsights,
  type DecisionFunnelInput,
  type DecisionInsightCandidate,
  type DecisionRuleEvaluation,
} from "./decision-insights.ts";
import type { AdSpendReconciliationResult } from "./funnel-calculations.ts";
import { prioritizeDecisionInsights } from "./insight-prioritization.ts";

const COHORT_ONLY_LIFETIME_CONTRIBUTION_QUALITY: ExternalDataQualitySignal = {
  state: "incomplete",
  sourceReason:
    "Lifetime Contribution Profit is cohort-scoped in V1; no business-level aggregate is defined for Decision Engine rules.",
};

export type DecisionDashboardInput = {
  currentBusiness: CoreCalculationResult | null;
  previousBusiness: CoreCalculationResult | null;
  adSpendReconciliation?: Pick<AdSpendReconciliationResult, "status"> | null;
  funnels?: readonly DecisionFunnelInput[];
  lifetimeContributionProfit?: string | null;
  lifetimeContributionQuality?: ExternalDataQualitySignal;
};

export type DecisionDashboardModel = {
  insights: readonly DecisionInsightCandidate[];
  fallbackMessageAr: string | null;
  evaluations: readonly DecisionRuleEvaluation[];
};

/** Composes Tasks 26–28 without changing their rules, thresholds, or prioritization. */
export function buildDecisionDashboardModel(input: DecisionDashboardInput): DecisionDashboardModel {
  const lifetimeContributionQuality =
    input.lifetimeContributionQuality ?? COHORT_ONLY_LIFETIME_CONTRIBUTION_QUALITY;

  const dataQuality = buildDataQualityProfile({
    currentBusiness: input.currentBusiness,
    previousBusiness: input.previousBusiness,
    adSpendReconciliation: input.adSpendReconciliation ?? null,
    funnels: input.funnels,
    customerEconomics: {
      lifetimeContributionProfit: lifetimeContributionQuality,
    },
  });

  const generated = generateRuleBasedInsights({
    currentBusiness: input.currentBusiness,
    previousBusiness: input.previousBusiness,
    dataQuality,
    funnels: input.funnels,
    ...(input.lifetimeContributionProfit === undefined
      ? {}
      : {
          customerEconomics: {
            lifetimeContributionProfit: input.lifetimeContributionProfit,
          },
        }),
  });

  return {
    insights: prioritizeDecisionInsights(generated.candidates),
    fallbackMessageAr: generated.fallbackMessageAr,
    evaluations: generated.evaluations,
  };
}
