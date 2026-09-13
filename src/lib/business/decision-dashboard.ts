import type { createSupabaseServerClient } from "../supabase/server";
import {
  buildCustomerEconomicsDecisionSignal,
  customerEconomicsDecisionQualitySignal,
  type CustomerEconomicsDecisionRow,
} from "./customer-economics-decision-signal";
import { buildDecisionDashboardModel, type DecisionDashboardModel } from "./decision-dashboard-model";
import type { DecisionFunnelInput } from "./decision-insights";
import { loadDashboardMonth } from "./dashboard-month";
import { loadFunnelMonth } from "./funnel-month";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type LoadedDecisionDashboard = {
  model: DecisionDashboardModel;
  currentPeriodExists: boolean;
  previousPeriodExists: boolean;
  currentPeriodLoadError: boolean;
  previousPeriodLoadError: boolean;
  sourceLoadError: boolean;
};

/** Loads only the monthly evidence needed to render deterministic Top-3 decision insights. */
export async function loadDecisionDashboard(
  supabase: ServerSupabaseClient,
  businessId: string,
  currentMonthStart: string,
  previousMonthStart: string | null,
): Promise<LoadedDecisionDashboard> {
  const [currentLoad, previousLoad, funnelMonth, customerEconomicsResult] = await Promise.all([
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
    supabase
      .from("customer_lifetime_contribution_profit_observations")
      .select("cohort_month,lifetime_contribution_profit_text,quality_state,currency")
      .eq("business_id", businessId)
      .eq("observation_month", currentMonthStart)
      .order("cohort_month", { ascending: true }),
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
  const currentPeriodLoadError = currentLoad.dataLoadError || currentLoad.calculationError;
  const previousPeriodLoadError = previousLoad.dataLoadError || previousLoad.calculationError;

  const customerEconomics = customerEconomicsResult.error
    ? null
    : buildCustomerEconomicsDecisionSignal(
        (customerEconomicsResult.data ?? []) as CustomerEconomicsDecisionRow[],
      );
  const lifetimeContributionQuality = customerEconomicsResult.error
    ? {
        state: "incomplete" as const,
        sourceReason: "CUSTOMER_ECONOMICS_LOAD_ERROR",
      }
    : customerEconomicsDecisionQualitySignal(customerEconomics!);

  return {
    model: buildDecisionDashboardModel({
      currentBusiness: currentLoad.result,
      previousBusiness: previousLoad.result,
      adSpendReconciliation: reconciliation,
      funnels,
      lifetimeContributionProfit:
        customerEconomics?.status === "ready"
          ? customerEconomics.lifetimeContributionProfit
          : null,
      lifetimeContributionQuality,
      lifetimeContributionEvidenceQuality: customerEconomics?.evidenceQuality ?? null,
    }),
    currentPeriodExists: currentLoad.periodExists,
    previousPeriodExists: previousLoad.periodExists,
    currentPeriodLoadError,
    previousPeriodLoadError,
    sourceLoadError:
      currentPeriodLoadError ||
      previousPeriodLoadError ||
      funnelMonth.dataLoadError ||
      funnelMonth.reconciliationError ||
      funnelMonth.calculatedEntries.some((entry) => entry.calculationError) ||
      Boolean(customerEconomicsResult.error),
  };
}
