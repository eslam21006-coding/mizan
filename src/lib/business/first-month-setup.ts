import "server-only";

import { evaluateFirstMonthCompleteness, type MonthCompleteness } from "./first-month-completeness.ts";

import { loadTransactionDerivedMonthlyCustomerCounts } from "@/lib/business/monthly-customer-counts";
import {
  buildMonthlyEntryRows,
  type ExpenseInputRow,
  type MonthlyPeriodValues,
  type RevenueInputRow,
} from "@/lib/business/monthly-entry-rows";
import {
  currentMonthKeyForTimeZone,
  parseMonthKey,
} from "@/lib/business/monthly";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readAllSetupPages } from "./setup-paged-rows.ts";

export type FirstMonthSetupData = {
  kind: "loaded";
  selectedMonthKey: string;
  currentMonthKey: string;
  hasSavedPeriod: boolean;
  completeness?: MonthCompleteness;
  isSavedHistorical: boolean;
  period: MonthlyPeriodValues;
  revenueRows: RevenueInputRow[];
  expenseRows: ExpenseInputRow[];
  payingCustomersDerived: boolean;
  newCustomersDerived: boolean;
};

export type FirstMonthSetupResult =
  | FirstMonthSetupData
  | { kind: "load_error"; selectedMonthKey: string; currentMonthKey: string };

/**
 * Loads a selected month through the same authenticated tables, derived counts, and pure row mapper
 * as the existing Monthly editor. No mutations or setup-specific calculations occur here.
 */
export async function loadFirstMonthSetup(
  businessId: string,
  monthKey: string,
  timeZone: string,
): Promise<FirstMonthSetupResult> {
  const currentMonthKey = currentMonthKeyForTimeZone(timeZone);
  const month = parseMonthKey(monthKey);
  if (!month) {
    return { kind: "load_error", selectedMonthKey: monthKey, currentMonthKey };
  }

  const supabase = await createSupabaseServerClient();
  const [periodResult, streamsResult, expensesResult, customerCountsResult] = await Promise.all([
    supabase
      .from("monthly_periods")
      .select(
        "id,created_at,new_customers,total_paying_customers,unallocated_gross_cash_collected,unallocated_refunds,adjustment_note",
      )
      .eq("business_id", businessId)
      .eq("month_start", month.monthStart)
      .maybeSingle(),
    readAllSetupPages((from, to) =>
      supabase
        .from("revenue_streams")
        .select("id,name,stream_type,is_active,created_at", { count: "exact" })
        .eq("business_id", businessId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    readAllSetupPages((from, to) =>
      supabase
        .from("expense_items")
        .select("id,name,category,cost_behavior,is_active,created_at", { count: "exact" })
        .eq("business_id", businessId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    loadTransactionDerivedMonthlyCustomerCounts(supabase, businessId, month.monthStart),
  ]);

  if (
    periodResult.error ||
    streamsResult.error ||
    expensesResult.error ||
    customerCountsResult.dataLoadError
  ) {
    return { kind: "load_error", selectedMonthKey: month.monthKey, currentMonthKey };
  }

  const period = periodResult.data;
  let revenueEntries: Array<Record<string, unknown>> = [];
  let expenseEntries: Array<Record<string, unknown>> = [];

  if (period?.id) {
    const [revenueResult, expenseResult] = await Promise.all([
      readAllSetupPages((from, to) =>
        supabase
          .from("monthly_revenue_entries")
          .select("revenue_stream_id,stream_name_snapshot,stream_type_snapshot,gross_cash_collected,refunds", { count: "exact" })
          .eq("business_id", businessId)
          .eq("monthly_period_id", period.id)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      readAllSetupPages((from, to) =>
        supabase
          .from("monthly_expense_entries")
          .select("expense_item_id,expense_name_snapshot,category_snapshot,cost_behavior_snapshot,input_value,customer_count_basis", { count: "exact" })
          .eq("business_id", businessId)
          .eq("monthly_period_id", period.id)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);
    if (revenueResult.error || expenseResult.error) {
      return { kind: "load_error", selectedMonthKey: month.monthKey, currentMonthKey };
    }
    revenueEntries = revenueResult.data ?? [];
    expenseEntries = expenseResult.data ?? [];
  }

  const payingCustomersDerived = customerCountsResult.available;
  const newCustomersDerived =
    customerCountsResult.available && customerCountsResult.counts.newCustomers !== null;
  const effectivePeriod: MonthlyPeriodValues = payingCustomersDerived
    ? {
        ...(period ?? {}),
        new_customers: newCustomersDerived
          ? customerCountsResult.counts.newCustomers
          : period?.new_customers,
        total_paying_customers: customerCountsResult.counts.totalPayingCustomers,
      }
    : period;

  const streams = streamsResult.data ?? [];
  const expenses = expensesResult.data ?? [];
  const rows = buildMonthlyEntryRows({ streams, expenses, revenueEntries, expenseEntries });
  const applicableRows = period
    ? buildMonthlyEntryRows({
        streams: streams.filter((stream) =>
          stream.created_at <= period.created_at ||
          revenueEntries.some((entry) => entry.revenue_stream_id === stream.id),
        ),
        expenses: expenses.filter((expense) =>
          expense.created_at <= period.created_at ||
          expenseEntries.some((entry) => entry.expense_item_id === expense.id),
        ),
        revenueEntries,
        expenseEntries,
      })
    : rows;
  // Setup completion must reflect saved values, not transaction-derived display counts.
  const completeness = evaluateFirstMonthCompleteness({
    hasSavedPeriod: Boolean(period),
    period,
    revenueRows: applicableRows.revenueRows,
    expenseRows: applicableRows.expenseRows,
  });

  return {
    kind: "loaded",
    selectedMonthKey: month.monthKey,
    completeness,
    currentMonthKey,
    hasSavedPeriod: Boolean(period),
    isSavedHistorical: month.monthKey < currentMonthKey && Boolean(period),
    period: effectivePeriod,
    ...rows,
    payingCustomersDerived,
    newCustomersDerived,
  };
}
