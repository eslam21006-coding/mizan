import type { createSupabaseServerClient } from "../supabase/server";
import { buildDecisionDashboardModel, type DecisionDashboardModel } from "./decision-dashboard-model";
import type { DecisionFunnelInput } from "./decision-insights";
import { loadDashboardMonth } from "./dashboard-month";
import { loadFunnelMonth } from "./funnel-month";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type LoadedDecisionDashboard = {
  model: DecisionDashboardModel;
  currentPeriodExists: boolean;
  previousPeriodExists: boolean;
  sourceLoadError: boolean;
};

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
