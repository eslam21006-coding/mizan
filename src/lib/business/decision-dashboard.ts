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

const CUSTOMER_ECONOMICS_PAGE_SIZE = 200;

type CustomerEconomicsRowsLoad =
  | { dataLoadError: false; rows: CustomerEconomicsDecisionRow[] }
  | { dataLoadError: true; rows: [] };

export type LoadedDecisionDashboard = {
  model: DecisionDashboardModel;
  currentPeriodExists: boolean;
  previousPeriodExists: boolean;
  currentPeriodLoadError: boolean;
  previousPeriodLoadError: boolean;
  sourceLoadError: boolean;
};

/**
 * Loads every acquisition-group observation for one Decision Engine month.
 * `count: exact` lets the loader prove it reached the full result set even when PostgREST applies
 * a lower server-side row cap than the requested page size. If the result count changes while pages
 * are being read, or a page unexpectedly becomes empty, the signal fails closed instead of using a
 * partial lifetime-profit aggregate.
 */
async function loadCustomerEconomicsRows(
  supabase: ServerSupabaseClient,
  businessId: string,
  currentMonthStart: string,
): Promise<CustomerEconomicsRowsLoad> {
  const rows: CustomerEconomicsDecisionRow[] = [];
  let expectedCount: number | null = null;

  while (expectedCount === null || rows.length < expectedCount) {
    const from = rows.length;
    const { data, error, count } = await supabase
      .from("customer_lifetime_contribution_profit_observations")
      .select("cohort_month,lifetime_contribution_profit_text,quality_state,currency", {
        count: "exact",
      })
      .eq("business_id", businessId)
      .eq("observation_month", currentMonthStart)
      .order("cohort_month", { ascending: true })
      .range(from, from + CUSTOMER_ECONOMICS_PAGE_SIZE - 1);

    if (error || count === null) return { dataLoadError: true, rows: [] };
    if (expectedCount === null) expectedCount = count;
    else if (count !== expectedCount) return { dataLoadError: true, rows: [] };

    const pageRows = (data ?? []) as CustomerEconomicsDecisionRow[];
    if (pageRows.length === 0) {
      return rows.length === expectedCount
        ? { dataLoadError: false, rows }
        : { dataLoadError: true, rows: [] };
    }

    rows.push(...pageRows);
    if (rows.length > expectedCount) return { dataLoadError: true, rows: [] };
  }

  return { dataLoadError: false, rows };
}

/** Loads only the monthly evidence needed to render deterministic Top-3 decision insights. */
export async function loadDecisionDashboard(
  supabase: ServerSupabaseClient,
  businessId: string,
  currentMonthStart: string,
  previousMonthStart: string | null,
): Promise<LoadedDecisionDashboard> {
  const [currentLoad, previousLoad, funnelMonth, customerEconomicsLoad] = await Promise.all([
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
    loadCustomerEconomicsRows(supabase, businessId, currentMonthStart),
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

  const customerEconomics = customerEconomicsLoad.dataLoadError
    ? null
    : buildCustomerEconomicsDecisionSignal(customerEconomicsLoad.rows);
  const lifetimeContributionQuality = customerEconomicsLoad.dataLoadError
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
      customerEconomicsLoad.dataLoadError,
  };
}
