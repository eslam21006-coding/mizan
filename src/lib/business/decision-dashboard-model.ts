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

const CUSTOMER_ECONOMICS_NOT_PROVIDED: ExternalDataQualitySignal = {
  state: "missing",
  sourceReason: "No as-of-month customer-economics decision signal was provided.",
};

export type DecisionDashboardInput = {
  currentBusiness: CoreCalculationResult | null;
  previousBusiness: CoreCalculationResult | null;
  adSpendReconciliation?: Pick<AdSpendReconciliationResult, "status"> | null;
  funnels?: readonly DecisionFunnelInput[];
  lifetimeContributionProfit?: string | null;
  lifetimeContributionQuality?: ExternalDataQualitySignal;
  lifetimeContributionEvidenceQuality?: "actual" | "estimated" | null;
};

export type DecisionDashboardModel = {
  insights: readonly DecisionInsightCandidate[];
  fallbackMessageAr: string | null;
  evaluations: readonly DecisionRuleEvaluation[];
  customerEconomicsEvidenceQuality: "actual" | "estimated" | null;
};

/** Composes Tasks 26–28 without changing their rules, thresholds, or prioritization. */
export function buildDecisionDashboardModel(input: DecisionDashboardInput): DecisionDashboardModel {
  const lifetimeContributionQuality =
    input.lifetimeContributionQuality ?? CUSTOMER_ECONOMICS_NOT_PROVIDED;

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
    customerEconomicsEvidenceQuality: input.lifetimeContributionEvidenceQuality ?? null,
  };
}
