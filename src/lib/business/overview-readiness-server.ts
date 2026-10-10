import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCustomerHistoryOverviewSummary } from "./customer-history-overview.ts";
import { loadFunnelMonth, type FunnelMonthlyEntrySnapshot } from "./funnel-month.ts";
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
import { loadBusinessSetup } from "./setup-loader.ts";

export type LoadedOverviewReadiness = {
  core: CoreSetupReadiness;
  history: HistoryReadiness;
  customers: CustomerReadiness;
  sales: SalesReadiness;
};

/** Treats explicit zeroes as entered data while rejecting a funnel month containing only null/blank fields. */
export function hasMeaningfulFunnelMonthlyData(
  entries: readonly FunnelMonthlyEntrySnapshot[],
) {
  return entries.some((entry) =>
    [
      entry.ad_spend,
      entry.leads,
      entry.booked_calls,
      entry.showed_calls,
      entry.qualified_calls,
      entry.sales,
      entry.new_customers,
      entry.cash_collected,
      entry.attributed_revenue,
    ].some((value) => value !== null && value !== undefined && String(value).trim() !== ""),
  );
}

/** Loads the four B16 Overview readiness domains from existing authoritative RLS-scoped data. */
export async function loadOverviewReadiness(
  businessId: string,
  monthStart: string,
): Promise<LoadedOverviewReadiness> {
  const [setup, supabase] = await Promise.all([
    loadBusinessSetup(businessId).catch(() => null),
    createSupabaseServerClient(),
  ]);

  const [transactionCountResult, reviewExceptionsResult, missingPeriodsResult, customerSummaryResult, funnelCountResult, funnelMonth] =
    await Promise.all([
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

  let core: CoreSetupReadiness;
  let history: HistoryReadiness;

  if (!setup || setup.kind !== "loaded") {
    core = resolveBusinessSetupCompatibility({
      loadState: "load_error",
      mode: "legacy",
      revenueSourceCount: null,
      expenseSetupReviewedAt: null,
      configuredExpenseItemCount: null,
      validMonthCount: null,
    }).coreSetup;
    history = resolveHistoryReadiness({ loadState: "load_error", validMonthCount: null });
  } else {
    const compatibility = resolveBusinessSetupCompatibility({
      loadState: "loaded",
      mode: "legacy",
      revenueSourceCount: setup.revenueSourceCount,
      expenseSetupReviewedAt: setup.business.expenseSetupReviewedAt ?? null,
      configuredExpenseItemCount: setup.expenseItems.length,
      validMonthCount: setup.persistedMonths.validMonthCount,
    });
    core = compatibility.coreSetup;
    history = resolveHistoryReadiness({
      loadState: "loaded",
      validMonthCount: setup.persistedMonths.validMonthCount,
    });
  }

  const customerLoadError = Boolean(
    transactionCountResult.error ||
      reviewExceptionsResult.error ||
      missingPeriodsResult.error ||
      customerSummaryResult.error,
  );
  const transactionCount = transactionCountResult.count ?? 0;
  const reviewIssueCount =
    (reviewExceptionsResult.data?.length ?? 0) + (missingPeriodsResult.data?.length ?? 0);
  const customerSummary = customerSummaryResult.error
    ? null
    : parseCustomerHistoryOverviewSummary(customerSummaryResult.data);
  const customers = resolveCustomerReadiness({
    loadState: customerLoadError ? "load_error" : "loaded",
    transactionCount: customerLoadError ? null : transactionCount,
    reviewIssueCount: customerLoadError ? null : reviewIssueCount,
    analysisReady: customerLoadError ? null : customerSummary !== null,
  });

  const salesLoadError = Boolean(funnelCountResult.error || funnelMonth.dataLoadError);
  const sales = resolveSalesReadiness({
    loadState: salesLoadError ? "load_error" : "loaded",
    funnelCount: salesLoadError ? null : (funnelCountResult.count ?? 0),
    monthlyDataReady: salesLoadError
      ? null
      : hasMeaningfulFunnelMonthlyData(funnelMonth.entries),
  });

  return { core, history, customers, sales };
}
