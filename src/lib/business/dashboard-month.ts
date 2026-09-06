import type { createSupabaseServerClient } from "../supabase/server";
import {
  calculateCoreFinancials,
  CalculationInputError,
  type CoreCalculationInput,
  type CoreCalculationResult,
} from "./calculations";
import { buildDashboardCalculationInput } from "./dashboard";
import { loadFunnelMonth } from "./funnel-month";
import { loadTransactionDerivedMonthlyCustomerCounts } from "./monthly-customer-counts";

export type DashboardMonthLoadResult = {
  periodExists: boolean;
  result: CoreCalculationResult | null;
  calculationInput: CoreCalculationInput | null;
  dataLoadError: boolean;
  calculationError: boolean;
};

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Loads one business month and calculates canonical dashboard financials, replacing manual customer
 * counts with transaction-derived counts whenever imported positive collections make them authoritative.
 */
export async function loadDashboardMonth(
  supabase: ServerSupabaseClient,
  businessId: string,
  monthStart: string,
): Promise<DashboardMonthLoadResult> {
  const { data: period, error: periodError } = await supabase
    .from("monthly_periods")
    .select(
      "id,new_customers,total_paying_customers,unallocated_gross_cash_collected,unallocated_refunds",
    )
    .eq("business_id", businessId)
    .eq("month_start", monthStart)
    .maybeSingle();

  if (periodError) {
    return {
      periodExists: false,
      result: null,
      calculationInput: null,
      dataLoadError: true,
      calculationError: false,
    };
  }

  if (!period?.id) {
    return {
      periodExists: false,
      result: null,
      calculationInput: null,
      dataLoadError: false,
      calculationError: false,
    };
  }

  const [revenueResult, expenseResult, funnelMonth, derivedCustomerCounts] = await Promise.all([
    supabase
      .from("monthly_revenue_entries")
      .select(
        "revenue_stream_id,stream_name_snapshot,stream_type_snapshot,gross_cash_collected,refunds",
      )
      .eq("business_id", businessId)
      .eq("monthly_period_id", period.id),
    supabase
      .from("monthly_expense_entries")
      .select(
        "expense_item_id,expense_name_snapshot,category_snapshot,cost_behavior_snapshot,input_value,customer_count_basis",
      )
      .eq("business_id", businessId)
      .eq("monthly_period_id", period.id),
    loadFunnelMonth(supabase, businessId, monthStart),
    loadTransactionDerivedMonthlyCustomerCounts(supabase, businessId, monthStart),
  ]);

  if (revenueResult.error || expenseResult.error) {
    return {
      periodExists: true,
      result: null,
      calculationInput: null,
      dataLoadError: true,
      calculationError: false,
    };
  }

  if (derivedCustomerCounts.dataLoadError) {
    return {
      periodExists: true,
      result: null,
      calculationInput: null,
      dataLoadError: true,
      calculationError: false,
    };
  }

  const effectivePeriod = derivedCustomerCounts.available
    ? {
        ...period,
        new_customers: derivedCustomerCounts.counts.newCustomers,
        total_paying_customers: derivedCustomerCounts.counts.totalPayingCustomers,
      }
    : period;

  try {
    const input = buildDashboardCalculationInput({
      period: effectivePeriod,
      revenueEntries: revenueResult.data ?? [],
      expenseEntries: expenseResult.data ?? [],
      canonicalAdSpend:
        !funnelMonth.reconciliationError && funnelMonth.reconciliation.canonicalAdSpend.available
          ? funnelMonth.reconciliation.canonicalAdSpend.value
          : null,
    });
    return {
      periodExists: true,
      result: calculateCoreFinancials(input),
      calculationInput: input,
      dataLoadError: false,
      calculationError: false,
    };
  } catch (error) {
    if (error instanceof CalculationInputError) {
      return {
        periodExists: true,
        result: null,
        calculationInput: null,
        dataLoadError: false,
        calculationError: true,
      };
    }
    throw error;
  }
}
