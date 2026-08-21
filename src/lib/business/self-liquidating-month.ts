import type { createSupabaseServerClient } from "../supabase/server";
import { calculateCoreFinancials, CalculationInputError } from "./calculations";
import { buildDashboardCalculationInput } from "./dashboard";
import { loadFunnelMonth } from "./funnel-month";
import {
  calculateSelfLiquidation,
  SelfLiquidationInputError,
  type SelfLiquidationResult,
} from "./self-liquidating";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type FrontEndRevenueMonthRow = {
  revenueStreamId: string;
  name: string;
  grossCash: string | null;
  refunds: string | null;
};

export type FrontEndExpenseAllocationRow = {
  monthlyExpenseEntryId: string;
  expenseItemId: string;
  name: string;
  behavior: "per_customer" | "percentage_revenue";
  expenseAmount: string | null;
  allocatedAmount: string | null;
};

export type LoadedSelfLiquidationMonth = {
  periodExists: boolean;
  result: SelfLiquidationResult | null;
  frontEndRevenueRows: FrontEndRevenueMonthRow[];
  variableExpenseRows: FrontEndExpenseAllocationRow[];
  canonicalAdSpend: string | null;
  adSpendUnavailable: boolean;
  dataLoadError: boolean;
  calculationError: boolean;
};

function nullableDecimal(value: unknown) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

export async function loadSelfLiquidationMonth(
  supabase: ServerSupabaseClient,
  businessId: string,
  monthStart: string,
): Promise<LoadedSelfLiquidationMonth> {
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
      frontEndRevenueRows: [],
      variableExpenseRows: [],
      canonicalAdSpend: null,
      adSpendUnavailable: true,
      dataLoadError: true,
      calculationError: false,
    };
  }

  if (!period?.id) {
    return {
      periodExists: false,
      result: null,
      frontEndRevenueRows: [],
      variableExpenseRows: [],
      canonicalAdSpend: null,
      adSpendUnavailable: true,
      dataLoadError: false,
      calculationError: false,
    };
  }

  const [revenueResult, expenseResult, allocationResult, funnelMonth] = await Promise.all([
    supabase
      .from("monthly_revenue_entries")
      .select(
        "revenue_stream_id,stream_name_snapshot,stream_type_snapshot,gross_cash_collected,refunds",
      )
      .eq("business_id", businessId)
      .eq("monthly_period_id", period.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("monthly_expense_entries")
      .select(
        "id,expense_item_id,expense_name_snapshot,category_snapshot,cost_behavior_snapshot,input_value,customer_count_basis",
      )
      .eq("business_id", businessId)
      .eq("monthly_period_id", period.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("monthly_front_end_expense_allocations")
      .select("monthly_expense_entry_id,allocated_amount")
      .eq("business_id", businessId)
      .eq("monthly_period_id", period.id),
    loadFunnelMonth(supabase, businessId, monthStart),
  ]);

  if (revenueResult.error || expenseResult.error || allocationResult.error) {
    return {
      periodExists: true,
      result: null,
      frontEndRevenueRows: [],
      variableExpenseRows: [],
      canonicalAdSpend: null,
      adSpendUnavailable: true,
      dataLoadError: true,
      calculationError: false,
    };
  }

  const revenueEntries = revenueResult.data ?? [];
  const expenseEntries = expenseResult.data ?? [];
  const allocationByEntryId = new Map(
    (allocationResult.data ?? []).map((allocation) => [
      String(allocation.monthly_expense_entry_id),
      nullableDecimal(allocation.allocated_amount),
    ]),
  );

  try {
    const core = calculateCoreFinancials(
      buildDashboardCalculationInput({
        period,
        revenueEntries,
        expenseEntries,
        canonicalAdSpend: null,
      }),
    );

    const expenseAmountByItemId = new Map(
      core.expensesByItem.map((expense) => [
        expense.id,
        expense.amount.available ? expense.amount.value : null,
      ]),
    );

    const frontEndRevenueRows: FrontEndRevenueMonthRow[] = revenueEntries
      .filter((entry) => entry.stream_type_snapshot === "front_end")
      .map((entry) => ({
        revenueStreamId: String(entry.revenue_stream_id),
        name: String(entry.stream_name_snapshot),
        grossCash: nullableDecimal(entry.gross_cash_collected),
        refunds: nullableDecimal(entry.refunds),
      }));

    const variableExpenseRows: FrontEndExpenseAllocationRow[] = expenseEntries
      .filter(
        (entry) =>
          entry.cost_behavior_snapshot === "per_customer" ||
          entry.cost_behavior_snapshot === "percentage_revenue",
      )
      .map((entry) => ({
        monthlyExpenseEntryId: String(entry.id),
        expenseItemId: String(entry.expense_item_id),
        name: String(entry.expense_name_snapshot),
        behavior: entry.cost_behavior_snapshot as "per_customer" | "percentage_revenue",
        expenseAmount: expenseAmountByItemId.get(String(entry.expense_item_id)) ?? null,
        allocatedAmount: allocationByEntryId.get(String(entry.id)) ?? null,
      }));

    const canonicalAdSpend =
      !funnelMonth.dataLoadError &&
      !funnelMonth.reconciliationError &&
      funnelMonth.reconciliation.canonicalAdSpend.available
        ? funnelMonth.reconciliation.canonicalAdSpend.value
        : null;

    const result = calculateSelfLiquidation({
      frontEndRevenue: frontEndRevenueRows.map((row) => ({
        grossCash: row.grossCash,
        refunds: row.refunds,
      })),
      variableExpenses: variableExpenseRows.map((row) => ({
        expenseAmount: row.expenseAmount,
        allocatedAmount: row.allocatedAmount,
      })),
      adSpend: canonicalAdSpend,
    });

    return {
      periodExists: true,
      result,
      frontEndRevenueRows,
      variableExpenseRows,
      canonicalAdSpend,
      adSpendUnavailable: canonicalAdSpend === null,
      dataLoadError: false,
      calculationError: false,
    };
  } catch (error) {
    if (error instanceof CalculationInputError || error instanceof SelfLiquidationInputError) {
      return {
        periodExists: true,
        result: null,
        frontEndRevenueRows: [],
        variableExpenseRows: [],
        canonicalAdSpend: null,
        adSpendUnavailable: true,
        dataLoadError: false,
        calculationError: true,
      };
    }
    throw error;
  }
}
