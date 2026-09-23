import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { resolveAdminViewingMenteeUserId } from "@/lib/admin-business-viewing";
import { requireAuthContext } from "@/lib/auth/context";
import { currentMonthKeyForTimeZone } from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { resolveBusinessOverviewHealth } from "@/lib/business-overview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessOverviewPanel } from "./business-overview-panel";
import { BusinessWorkspaceShell } from "./business-workspace-shell";

type BusinessOverviewPageProps = {
  params: Promise<{ businessId: string }>;
};

/** Loads the selected business and renders the Overview tab inside the shared workspace shell. */
export default async function BusinessOverviewPage({ params }: BusinessOverviewPageProps) {
  const { businessId: rawBusinessId } = await params;
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

  const currentMonthKey = currentMonthKeyForTimeZone(business.timezone);
  const currentMonthStart = `${currentMonthKey}-01`;
  const [streamsResult, expensesResult, currentPeriodResult, latestPeriodResult] = await Promise.all([
    supabase
      .from("revenue_streams")
      .select("id")
      .eq("business_id", businessId)
      .eq("is_active", true),
    supabase
      .from("expense_items")
      .select("id")
      .eq("business_id", businessId)
      .eq("is_active", true),
    supabase
      .from("monthly_periods")
      .select("month_start")
      .eq("business_id", businessId)
      .eq("month_start", currentMonthStart)
      .maybeSingle(),
    supabase
      .from("monthly_periods")
      .select("month_start")
      .eq("business_id", businessId)
      .order("month_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const dataLoadError = Boolean(
    streamsResult.error ||
      expensesResult.error ||
      currentPeriodResult.error ||
      latestPeriodResult.error,
  );
  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;
  const adminViewingMenteeUserId = resolveAdminViewingMenteeUserId(
    auth.role,
    auth.userId,
    business.owner_user_id,
  );
  const latestSavedMonthKey = latestPeriodResult.data?.month_start
    ? String(latestPeriodResult.data.month_start).slice(0, 7)
    : null;
  const overviewHealth = resolveBusinessOverviewHealth({
    businessId,
    currentMonthKey,
    revenueSourceCount: streamsResult.data?.length ?? 0,
    expenseItemCount: expensesResult.data?.length ?? 0,
    currentMonthSaved: Boolean(currentPeriodResult.data),
    latestSavedMonthKey,
    canManage,
    dataLoadError,
  });

  return (
    <div className="page-stack">
      <BusinessWorkspaceShell
        businessId={businessId}
        businessName={business.name}
        baseCurrency={business.base_currency}
        timezone={business.timezone}
        activeTab="overview"
        adminViewingMenteeUserId={adminViewingMenteeUserId}
      />

      <PageHeading
        title="نظرة عامة"
        description={`مساحة العمل الخاصة بـ ${business.name} لإدارة هيكل البزنس من مكان واحد.`}
      />

      <BusinessOverviewPanel
        baseCurrency={business.base_currency}
        timezone={business.timezone}
        revenueSourceCount={streamsResult.data?.length ?? 0}
        expenseItemCount={expensesResult.data?.length ?? 0}
        health={overviewHealth}
      />
    </div>
  );
}
