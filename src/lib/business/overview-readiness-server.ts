import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCustomerHistoryOverviewSummary } from "./customer-history-overview.ts";
import { assessSavedSetupMonths } from "./setup-month-readiness.ts";
import { readAllSetupPages } from "./setup-paged-rows.ts";
import { loadFunnelMonth } from "./funnel-month.ts";
import {
  effectiveOverviewFunnelCount,
  hasMeaningfulFunnelMonthlyData,
} from "./overview-readiness.ts";
import {
  resolveCustomerReadiness,
  resolveHistoryReadiness,
  resolveSalesReadiness,
  type CoreSetupReadiness,
  type CustomerReadiness,
  type HistoryReadiness,
  type SalesReadiness,
} from "./readiness.ts";
import { resolveBusinessSetupCompatibility } from "./setup-compatibility.ts";

export type LoadedOverviewReadiness = {
  core: CoreSetupReadiness;
  history: HistoryReadiness;
  customers: CustomerReadiness;
  sales: SalesReadiness;
};

const OVERVIEW_HISTORY_BATCH_SIZE = 12;
const OVERVIEW_HISTORY_READY_CAP = 3;

/**
 * Loads only the setup facts B16 needs and scans history in bounded batches.
 *
 * Overview displays History as 0, 1, 2, or 3+ months, so once three complete months are
 * established there is no user-visible value in materializing older monthly rows.
 */
async function loadOverviewSetupFacts(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  businessId: string,
) {
  const [businessResult, activeStreamsResult, streamsResult, expensesResult] = await Promise.all([
    supabase
      .from("businesses")
      .select("expense_setup_reviewed_at")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("revenue_streams")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("is_active", true),
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
  ]);

  if (
    businessResult.error ||
    !businessResult.data ||
    activeStreamsResult.error ||
    streamsResult.error ||
    expensesResult.error
  ) {
    throw new Error("Failed to load Overview setup readiness facts.");
  }

  let validMonthCount = 0;
  let offset = 0;

  while (validMonthCount < OVERVIEW_HISTORY_READY_CAP) {
    const periodsResult = await supabase
      .from("monthly_periods")
      .select(
        "id,month_start,created_at,new_customers,total_paying_customers,unallocated_gross_cash_collected,unallocated_refunds",
      )
      .eq("business_id", businessId)
      .order("month_start", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + OVERVIEW_HISTORY_BATCH_SIZE - 1);

    if (periodsResult.error) {
      throw new Error("Failed to load Overview monthly readiness periods.");
    }

    const periods = periodsResult.data ?? [];
    if (periods.length === 0) break;

    const periodIds = periods.map((period) => period.id);
    const [revenueEntriesResult, expenseEntriesResult] = await Promise.all([
      readAllSetupPages((from, to) =>
        supabase
          .from("monthly_revenue_entries")
          .select(
            "id,monthly_period_id,revenue_stream_id,stream_name_snapshot,stream_type_snapshot,gross_cash_collected,refunds",
            { count: "exact" },
          )
          .eq("business_id", businessId)
          .in("monthly_period_id", periodIds)
          .order("id", { ascending: true })
          .range(from, to),
      ),
      readAllSetupPages((from, to) =>
        supabase
          .from("monthly_expense_entries")
          .select(
            "id,monthly_period_id,expense_item_id,expense_name_snapshot,category_snapshot,cost_behavior_snapshot,input_value,customer_count_basis",
            { count: "exact" },
          )
          .eq("business_id", businessId)
          .in("monthly_period_id", periodIds)
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);

    if (revenueEntriesResult.error || expenseEntriesResult.error) {
      throw new Error("Failed to load Overview monthly readiness entries.");
    }

    validMonthCount += assessSavedSetupMonths({
      periods,
      streams: streamsResult.data ?? [],
      expenses: expensesResult.data ?? [],
      revenueEntries: revenueEntriesResult.data ?? [],
      expenseEntries: expenseEntriesResult.data ?? [],
    }).validMonthCount;

    if (periods.length < OVERVIEW_HISTORY_BATCH_SIZE) break;
    offset += OVERVIEW_HISTORY_BATCH_SIZE;
  }

  return {
    revenueSourceCount: activeStreamsResult.count ?? 0,
    expenseSetupReviewedAt: businessResult.data.expense_setup_reviewed_at,
    configuredExpenseItemCount: expensesResult.data?.length ?? 0,
    validMonthCount: Math.min(validMonthCount, OVERVIEW_HISTORY_READY_CAP),
  };
}

/** Returns a fail-closed B16 model when readiness data cannot be loaded safely. */
function unavailableOverviewReadiness(): LoadedOverviewReadiness {
  return {
    core: resolveBusinessSetupCompatibility({
      loadState: "load_error",
      mode: "legacy",
      revenueSourceCount: null,
      expenseSetupReviewedAt: null,
      configuredExpenseItemCount: null,
      validMonthCount: null,
    }).coreSetup,
    history: resolveHistoryReadiness({ loadState: "load_error", validMonthCount: null }),
    customers: resolveCustomerReadiness({
      loadState: "load_error",
      transactionCount: null,
      reviewIssueCount: null,
      analysisReady: null,
    }),
    sales: resolveSalesReadiness({
      loadState: "load_error",
      funnelCount: null,
      monthlyDataReady: null,
    }),
  };
}

/** Loads the four B16 Overview readiness domains from existing authoritative RLS-scoped data. */
export async function loadOverviewReadiness(
  businessId: string,
  monthStart: string,
): Promise<LoadedOverviewReadiness> {
  try {
  const supabase = await createSupabaseServerClient();

  const [setupFacts, transactionCountResult, reviewExceptionsResult, missingPeriodsResult, customerSummaryResult, funnelCountResult, funnelMonth] =
    await Promise.all([
      loadOverviewSetupFacts(supabase, businessId),
      supabase
        .from("customer_transactions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
      supabase
        .from("customer_economics_review_exceptions")
        .select("exception_code")
        .eq("business_id", businessId),
      supabase
        .from("customer_economics_missing_period_exceptions")
        .select("exception_code")
        .eq("business_id", businessId),
      supabase
        .from("customer_history_overview")
        .select(
          "paying_customer_count_text,repeat_customer_count_text,net_cash_collected_text,revenue_per_paying_customer_text",
        )
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("funnels")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("is_active", true),
      loadFunnelMonth(supabase, businessId, monthStart),
    ]);

  const compatibility = resolveBusinessSetupCompatibility({
    loadState: "loaded",
    mode: "legacy",
    revenueSourceCount: setupFacts.revenueSourceCount,
    expenseSetupReviewedAt: setupFacts.expenseSetupReviewedAt,
    configuredExpenseItemCount: setupFacts.configuredExpenseItemCount,
    validMonthCount: setupFacts.validMonthCount,
  });
  const core = compatibility.coreSetup;
  const history = resolveHistoryReadiness({
    loadState: "loaded",
    validMonthCount: setupFacts.validMonthCount,
  });

  const transactionCount = transactionCountResult.count ?? 0;
  const reviewIssueCount =
    (reviewExceptionsResult.data?.length ?? 0) + (missingPeriodsResult.data?.length ?? 0);
  const customerSummary = customerSummaryResult.error
    ? null
    : parseCustomerHistoryOverviewSummary(customerSummaryResult.data);
  const customerLoadError = Boolean(
    transactionCountResult.error ||
      reviewExceptionsResult.error ||
      missingPeriodsResult.error ||
      customerSummaryResult.error ||
      (transactionCount > 0 && customerSummary === null),
  );
  const customers = resolveCustomerReadiness({
    loadState: customerLoadError ? "load_error" : "loaded",
    transactionCount: customerLoadError ? null : transactionCount,
    reviewIssueCount: customerLoadError ? null : reviewIssueCount,
    analysisReady: customerLoadError ? null : customerSummary !== null,
  });

  const salesLoadError = Boolean(funnelCountResult.error || funnelMonth.dataLoadError);
  const activeFunnelCount = funnelCountResult.count ?? 0;
  const sales = resolveSalesReadiness({
    loadState: salesLoadError ? "load_error" : "loaded",
    funnelCount: salesLoadError
      ? null
      : effectiveOverviewFunnelCount(activeFunnelCount, funnelMonth.entries),
    monthlyDataReady: salesLoadError
      ? null
      : hasMeaningfulFunnelMonthlyData(
          funnelMonth.entries,
          funnelMonth.period?.business_ad_spend ?? null,
        ),
  });

    return { core, history, customers, sales };
  } catch {
    return unavailableOverviewReadiness();
  }
}
