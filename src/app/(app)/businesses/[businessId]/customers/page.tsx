import { notFound } from "next/navigation";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CustomerCohortLtvTable } from "./customer-cohort-ltv-table";
import { CustomerGroupsTable } from "./customer-groups-table";
import { CustomerOverviewShell } from "./customer-overview-shell";
import { LifetimeContributionTable } from "./lifetime-contribution-table";
import { LifetimeRevenueStreamTable } from "./lifetime-revenue-stream-table";

type BusinessCustomersPageProps = {
  params: Promise<{ businessId: string }>;
};

/** Loads one authorized business context and composes its existing customer-economics analyses. */
export default async function BusinessCustomersPage({ params }: BusinessCustomersPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) notFound();

  return (
    <CustomerOverviewShell
      businessId={business.id}
      businessName={business.name}
      baseCurrency={business.base_currency}
      timezone={business.timezone}
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
