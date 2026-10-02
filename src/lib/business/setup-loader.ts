import "server-only";

import { requireAuthContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ExpenseCategoryCounts,
  SetupExpenseItem,
} from "./expenses.ts";
import type { RevenueStreamType } from "./revenue-streams.ts";
import { assessSavedSetupMonths } from "./setup-month-readiness.ts";
import {
  resolveBusinessSetupQueryState,
  resolveBusinessSetupReadiness,
  type BusinessSetupReadiness,
} from "./setup-readiness.ts";

export type SetupRevenueSource = {
  id: string;
  name: string;
  streamType: RevenueStreamType;
  isActive: boolean;
};

export type LoadedBusinessSetup = {
  kind: "loaded";
  business: {
    id: string;
    name: string;
    baseCurrency: string;
    timezone: string;
  };
  canManage: boolean;
  revenueSources: SetupRevenueSource[];
  revenueSourceCount: number;
  expenseItems: SetupExpenseItem[];
  activeExpenseCategoryCounts: ExpenseCategoryCounts;
  latestSavedMonthKey: string | null;
  readiness: BusinessSetupReadiness;
};

export type BusinessSetupLoadResult =
  | LoadedBusinessSetup
  | { kind: "not_found" }
  | {
      kind: "load_error";
      business: LoadedBusinessSetup["business"];
      canManage: boolean;
      readiness: BusinessSetupReadiness;
    };

/**
 * Loads authoritative Core Setup facts and founder-facing setup rows through the authenticated RLS path.
 *
 * Revenue readiness still counts active revenue sources only. Expense rows and independent active
 * category counts support B07 presentation, while canonical Expense readiness continues to depend
 * only on the B02 explicit review timestamp.
 */
export async function loadBusinessSetup(
  businessId: string,
): Promise<BusinessSetupLoadResult> {
  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,owner_user_id,expense_setup_reviewed_at")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError) {
    throw new Error("Failed to load business for setup.");
  }
  if (!business) {
    return { kind: "not_found" };
  }

  const businessContext = {
    id: business.id,
    name: business.name,
    baseCurrency: business.base_currency,
    timezone: business.timezone,
  };
  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;

  const [
    streamsResult,
    activeStreamsResult,
    latestPeriodResult,
    expensesResult,
    acquisitionCountResult,
    fulfillmentCountResult,
    overheadCountResult,
    financialCountResult,
    savedRevenueResult,
    savedExpenseResult,
  ] = await Promise.all([
    supabase
      .from("revenue_streams")
      .select("id,name,stream_type,is_active,created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
    supabase
      .from("revenue_streams")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("is_active", true),
    supabase
      .from("monthly_periods")
      .select("id,month_start,created_at,new_customers,total_paying_customers,unallocated_gross_cash_collected,unallocated_refunds")
      .eq("business_id", businessId)
      .order("month_start", { ascending: false })
      .range(0, 999),
    supabase
      .from("expense_items")
      .select("id,name,category,cost_behavior,is_active,created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
    supabase
      .from("expense_items")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("category", "acquisition")
      .eq("is_active", true),
    supabase
      .from("expense_items")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("category", "fulfillment")
      .eq("is_active", true),
    supabase
      .from("expense_items")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("category", "overhead")
      .eq("is_active", true),
    supabase
      .from("expense_items")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("category", "financial")
      .eq("is_active", true),
    supabase
      .from("monthly_revenue_entries")
      .select("monthly_period_id,revenue_stream_id,stream_name_snapshot,stream_type_snapshot,gross_cash_collected,refunds")
      .eq("business_id", businessId)
      .range(0, 999),
    supabase
      .from("monthly_expense_entries")
      .select("monthly_period_id,expense_item_id,expense_name_snapshot,category_snapshot,cost_behavior_snapshot,input_value,customer_count_basis")
      .eq("business_id", businessId)
      .range(0, 999),
  ]);

  const queryState = resolveBusinessSetupQueryState({
    revenueSourcesError: streamsResult.error,
    activeRevenueSourceCountError: activeStreamsResult.error,
    latestPeriodError:
      latestPeriodResult.error ||
      savedRevenueResult.error ||
      savedExpenseResult.error ||
      (latestPeriodResult.data?.length === 1000 ||
        savedRevenueResult.data?.length === 1000 ||
        savedExpenseResult.data?.length === 1000
        ? new Error("Setup readiness exceeds the bounded read; must paginate")
        : null),
    expenseItemsError: expensesResult.error,
    activeExpenseCategoryErrors: [
      acquisitionCountResult.error,
      fulfillmentCountResult.error,
      overheadCountResult.error,
      financialCountResult.error,
    ],
  });
  if (queryState.kind === "load_error") {
    return {
      kind: "load_error",
      business: businessContext,
      canManage,
      readiness: resolveBusinessSetupReadiness({
        loadState: "load_error",
        revenueSourceCount: null,
        expenseSetupReviewedAt: business.expense_setup_reviewed_at,
        validMonthCount: null,
      }),
    };
  }

  const persistedMonths = assessSavedSetupMonths({
    periods: latestPeriodResult.data ?? [],
    streams: streamsResult.data ?? [],
    expenses: expensesResult.data ?? [],
    revenueEntries: savedRevenueResult.data ?? [],
    expenseEntries: savedExpenseResult.data ?? [],
  });
  const latestSavedMonthKey = persistedMonths.latestSavedMonthKey;
  const revenueSources: SetupRevenueSource[] = (streamsResult.data ?? []).map((stream) => ({
    id: stream.id,
    name: stream.name,
    streamType: stream.stream_type,
    isActive: stream.is_active,
  }));
  const expenseItems: SetupExpenseItem[] = (expensesResult.data ?? []).map((expense) => ({
    id: expense.id,
    name: expense.name,
    category: expense.category,
    costBehavior: expense.cost_behavior,
    isActive: expense.is_active,
  }));
  const activeExpenseCategoryCounts: ExpenseCategoryCounts = {
    acquisition: acquisitionCountResult.count ?? 0,
    fulfillment: fulfillmentCountResult.count ?? 0,
    overhead: overheadCountResult.count ?? 0,
    financial: financialCountResult.count ?? 0,
  };
  const revenueSourceCount = activeStreamsResult.count ?? 0;

  return {
    kind: "loaded",
    business: businessContext,
    canManage,
    revenueSources,
    revenueSourceCount,
    expenseItems,
    activeExpenseCategoryCounts,
    latestSavedMonthKey,
    readiness: resolveBusinessSetupReadiness({
      loadState: "loaded",
      revenueSourceCount,
      expenseSetupReviewedAt: business.expense_setup_reviewed_at,
      validMonthCount: persistedMonths.validMonthCount,
    }),
  };
}
