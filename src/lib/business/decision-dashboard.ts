import type { createSupabaseServerClient } from "../supabase/server.ts";
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
import { loadDashboardMonth } from "./dashboard-month.ts";
import type { AdSpendReconciliationResult } from "./funnel-calculations.ts";
import { loadFunnelMonth } from "./funnel-month.ts";
import { prioritizeDecisionInsights } from "./insight-prioritization.ts";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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

export type LoadedDecisionDashboard = {
  model: DecisionDashboardModel;
  currentPeriodExists: boolean;
  previousPeriodExists: boolean;
  sourceLoadError: boolean;
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

/** Loads only the monthly evidence needed to render deterministic Top-3 decision insights. */
export async function loadDecisionDashboard(
  supabase: ServerSupabaseClient,
  businessId: string,
  currentMonthStart: string,
  previousMonthStart: string | null,
): Promise<LoadedDecisionDashboard> {
  const [currentLoad, previousLoad, funnelMonth] = await Promise.all([
    loadDashboardMonth(supabase, businessId, currentMonthStart),
    previousMonthStart
      ? loadDashboardMonth(supabase, businessId, previousMonthStart)
      : Promise.resolve({
          periodExists: false,
          result: null,
          calculationInput: null,
          dataLoadError: false,
          calculationError: false,
        }),
    loadFunnelMonth(supabase, businessId, currentMonthStart),
  ]);

  const funnels: DecisionFunnelInput[] = funnelMonth.calculatedEntries.flatMap((entry) =>
    entry.result
      ? [
          {
            id: entry.entry.funnel_id,
            name: entry.entry.funnel_name_snapshot,
            metrics: entry.result,
          },
        ]
      : [],
  );

  const reconciliation =
    funnelMonth.dataLoadError || funnelMonth.reconciliationError
      ? null
      : funnelMonth.reconciliation;

  return {
    model: buildDecisionDashboardModel({
      currentBusiness: currentLoad.result,
      previousBusiness: previousLoad.result,
      adSpendReconciliation: reconciliation,
      funnels,
    }),
    currentPeriodExists: currentLoad.periodExists,
    previousPeriodExists: previousLoad.periodExists,
    sourceLoadError:
      currentLoad.dataLoadError ||
      currentLoad.calculationError ||
      previousLoad.dataLoadError ||
      previousLoad.calculationError ||
      funnelMonth.dataLoadError ||
      funnelMonth.reconciliationError ||
      funnelMonth.calculatedEntries.some((entry) => entry.calculationError),
  };
}
