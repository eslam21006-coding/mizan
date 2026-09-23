import { notFound } from "next/navigation";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { ReadOnlyNotice } from "@/components/read-only-notice";
import { requireAuthContext } from "@/lib/auth/context";
import { parseCustomerHistoryOverviewSummary } from "@/lib/business/customer-history-overview";
import { parseResourceId } from "@/lib/business/revenue-streams";
import {
  parseCustomerAnalysisView,
  type CustomerSearchParams,
} from "@/lib/customer-analysis-view";
import { parseReturnOrigin } from "@/lib/return-origin";
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
  const profitabilityReturnOrigin =
    activeView === "profitability"
      ? parseReturnOrigin({
          origin: "customer-profitability",
          month: customerSearchParams.month,
        })
      : null;
  const parsedInsightReturnOrigin = parseReturnOrigin({
    origin: customerSearchParams.origin,
    month: customerSearchParams.return_month ?? customerSearchParams.month,
    insight_rule: customerSearchParams.insight_rule,
    insight_subject: customerSearchParams.insight_subject,
  });
  const insightReturnOrigin =
    parsedInsightReturnOrigin?.origin === "insights" ? parsedInsightReturnOrigin : null;
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,owner_user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) notFound();
  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;

  const [historyOverviewResult, reviewExceptionsResult, missingPeriodsResult] = await Promise.all([
    supabase
      .from("customer_history_overview")
      .select(
        "paying_customer_count_text,repeat_customer_count_text,net_cash_collected_text,revenue_per_paying_customer_text",
      )
      .eq("business_id", business.id)
      .maybeSingle(),
    supabase
      .from("customer_economics_review_exceptions")
      .select("exception_code")
      .eq("business_id", business.id),
    supabase
      .from("customer_economics_missing_period_exceptions")
      .select("exception_code")
      .eq("business_id", business.id),
  ]);

  const historyOverviewSummary = historyOverviewResult.error
    ? null
    : parseCustomerHistoryOverviewSummary(historyOverviewResult.data);
  const historyOverviewLoadError = Boolean(
    historyOverviewResult.error || !historyOverviewSummary,
  );
  const reviewLoadError = Boolean(reviewExceptionsResult.error || missingPeriodsResult.error);
  const reviewIssueCount = reviewLoadError
    ? null
    : (reviewExceptionsResult.data?.length ?? 0) + (missingPeriodsResult.data?.length ?? 0);

  return (
    <div className="page-stack">
      {insightReturnOrigin && (
        <ReturnContextBanner
          purpose="مراجعة اقتصاديات العميل المرتبطة بهذه الملاحظة"
          origin={insightReturnOrigin}
          context={{ businessId: business.id }}
          returnLabel="العودة إلى الملاحظة"
          ariaLabel="سياق العودة من اقتصاديات العميل"
        />
      )}
      {!canManage && (
        <ReadOnlyNotice description="يمكنك مراجعة اقتصاديات العميل وسجل العملاء، لكن استيراد المعاملات وتعديل إعدادات البيانات متاحان لمالك البزنس أو الأدمن." />
      )}
      <CustomerOverviewShell
      businessId={business.id}
      businessName={business.name}
      baseCurrency={business.base_currency}
      timezone={business.timezone}
      canManage={canManage}
      activeView={activeView}
      searchParams={customerSearchParams}
      reviewIssueCount={reviewIssueCount}
      reviewLoadError={reviewLoadError}
      historyOverview={
        <CustomerHistoryOverview
          baseCurrency={business.base_currency}
          summary={historyOverviewSummary}
          loadError={historyOverviewLoadError}
        />
      }
      observedLtv={
        <CustomerCohortLtvTable
          businessId={business.id}
          baseCurrency={business.base_currency}
          canManage={canManage}
        />
      }
      revenueStreams={
        <LifetimeRevenueStreamTable businessId={business.id} baseCurrency={business.base_currency} />
      }
      contribution={
        <LifetimeContributionTable
          businessId={business.id}
          baseCurrency={business.base_currency}
          canManage={canManage}
          returnMonth={
            profitabilityReturnOrigin?.origin === "customer-profitability"
              ? profitabilityReturnOrigin.month
              : undefined
          }
        />
      }
      customers={
        <CustomerGroupsTable
          businessId={business.id}
          baseCurrency={business.base_currency}
          timezone={business.timezone}
        />
      }
    />
    </div>
  );
}
