import { notFound } from "next/navigation";
import { parseCustomerHistoryOverviewSummary } from "@/lib/business/customer-history-overview";
import { parseResourceId } from "@/lib/business/revenue-streams";
import {
  parseCustomerAnalysisView,
  type CustomerSearchParams,
} from "@/lib/customer-analysis-view";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CustomerCohortLtvTable } from "./customer-cohort-ltv-table";
import { CustomerGroupsTable } from "./customer-groups-table";
import { CustomerHistoryOverview } from "./customer-history-overview";
import { CustomerOverviewShell } from "./customer-overview-shell";
import { LifetimeContributionTable } from "./lifetime-contribution-table";
import { LifetimeRevenueStreamTable } from "./lifetime-revenue-stream-table";

type BusinessCustomersPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<CustomerSearchParams>;
};

/** Loads one authorized business context and composes its URL-addressable customer-economics views. */
export default async function BusinessCustomersPage({
  params,
  searchParams,
}: BusinessCustomersPageProps) {
  const { businessId: rawBusinessId } = await params;
  const customerSearchParams = await searchParams;
  const activeView = parseCustomerAnalysisView(customerSearchParams.view);
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) notFound();

  const { data: historyOverviewData, error: historyOverviewError } = await supabase
    .from("customer_history_overview")
    .select(
      "paying_customer_count_text,repeat_customer_count_text,net_cash_collected_text,revenue_per_paying_customer_text",
    )
    .eq("business_id", business.id)
    .maybeSingle();
  const historyOverviewSummary = historyOverviewError
    ? null
    : parseCustomerHistoryOverviewSummary(historyOverviewData);
  const historyOverviewLoadError = Boolean(historyOverviewError || !historyOverviewSummary);

  return (
    <CustomerOverviewShell
      businessId={business.id}
      businessName={business.name}
      baseCurrency={business.base_currency}
      timezone={business.timezone}
      activeView={activeView}
      searchParams={customerSearchParams}
      historyOverview={
        <CustomerHistoryOverview
          baseCurrency={business.base_currency}
          summary={historyOverviewSummary}
          loadError={historyOverviewLoadError}
        />
      }
      observedLtv={
        <CustomerCohortLtvTable businessId={business.id} baseCurrency={business.base_currency} />
      }
      revenueStreams={
        <LifetimeRevenueStreamTable businessId={business.id} baseCurrency={business.base_currency} />
      }
      contribution={
        <LifetimeContributionTable businessId={business.id} baseCurrency={business.base_currency} />
      }
      customers={
        <CustomerGroupsTable
          businessId={business.id}
          baseCurrency={business.base_currency}
          timezone={business.timezone}
        />
      }
    />
  );
}
