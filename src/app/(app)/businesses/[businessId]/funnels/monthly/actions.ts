"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { parseFunnelResourceId } from "@/lib/business/funnels";
import {
  parseMonthKey,
  parseOptionalCountInput,
  parseOptionalDecimalInput,
  parseOptionalSignedDecimalInput,
} from "@/lib/business/monthly";
import {
  parseFunnelMonthlyReturnOrigin,
  type FunnelMonthlyReturnOrigin,
} from "@/lib/funnel-monthly-return-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function funnelMonthlyPath(
  businessId: string,
  monthKey: string,
  status?: string,
  returnOrigin?: FunnelMonthlyReturnOrigin | null,
) {
  const query = new URLSearchParams({ month: monthKey });
  if (status) query.set("status", status);
  if (returnOrigin) {
    query.set("origin", returnOrigin.origin);
    if (returnOrigin.origin === "insights") {
      query.set("return_month", returnOrigin.month);
      query.set("insight_rule", returnOrigin.ruleId);
      if (returnOrigin.subjectId) query.set("insight_subject", returnOrigin.subjectId);
    }
  }
  return `/businesses/${businessId}/funnels/monthly?${query.toString()}`;
}

function redirectFunnelMonthly(
  businessId: string,
  monthKey: string,
  status: string,
  returnOrigin?: FunnelMonthlyReturnOrigin | null,
): never {
  revalidatePath("/");
  revalidatePath("/analytics");
  revalidatePath("/insights");
  revalidatePath(`/businesses/${businessId}/funnels/monthly`);
  redirect(funnelMonthlyPath(businessId, monthKey, status, returnOrigin));
}

/** Reads one allow-listed Funnel Monthly return origin and fails closed on ambiguity. */
function parseReturnOriginFromFormData(formData: FormData) {
  const origins = formData.getAll("origin");
  const returnMonths = formData.getAll("return_month");
  const insightRules = formData.getAll("insight_rule");
  const insightSubjects = formData.getAll("insight_subject");

  if (origins.length === 0) return null;
  if (
    origins.length !== 1 ||
    returnMonths.length > 1 ||
    insightRules.length > 1 ||
    insightSubjects.length > 1 ||
    typeof origins[0] !== "string"
  ) {
    return null;
  }

  const returnMonth = returnMonths[0];
  const insightRule = insightRules[0];
  const insightSubject = insightSubjects[0];
  if (
    (returnMonth !== undefined && typeof returnMonth !== "string") ||
    (insightRule !== undefined && typeof insightRule !== "string") ||
    (insightSubject !== undefined && typeof insightSubject !== "string")
  ) {
    return null;
  }

  return parseFunnelMonthlyReturnOrigin({
    origin: origins[0],
    month: returnMonth,
    insight_rule: insightRule,
    insight_subject: insightSubject,
  });
}

function uniqueFunnelIds(values: FormDataEntryValue[]) {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const id = parseFunnelResourceId(value);
    if (!id || seen.has(id)) return null;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

export async function saveFunnelMonthlyActuals(formData: FormData) {
  await requireAuthContext();

  const businessId = parseFunnelResourceId(formData.get("business_id"));
  const month = parseMonthKey(formData.get("month"));
  const returnOrigin = parseReturnOriginFromFormData(formData);
  if (!businessId) redirect("/businesses");
  if (!month) {
    const query = new URLSearchParams({ status: "invalid-month" });
    if (returnOrigin) query.set("origin", returnOrigin.origin);
    redirect(`/businesses/${businessId}/funnels/monthly?${query.toString()}`);
  }

  const businessAdSpend = parseOptionalDecimalInput(formData.get("business_ad_spend"));
  if (!businessAdSpend.ok) {
    redirectFunnelMonthly(businessId, month.monthKey, "invalid-input", returnOrigin);
  }

  const funnelIds = uniqueFunnelIds(formData.getAll("funnel_id"));
  if (!funnelIds) {
    redirectFunnelMonthly(businessId, month.monthKey, "invalid-input", returnOrigin);
  }

  const funnelEntries = [];
  for (const funnelId of funnelIds) {
    const adSpend = parseOptionalDecimalInput(formData.get(`ad_spend_${funnelId}`));
    const leads = parseOptionalCountInput(formData.get(`leads_${funnelId}`));
    const bookedCalls = parseOptionalCountInput(formData.get(`booked_calls_${funnelId}`));
    const showedCalls = parseOptionalCountInput(formData.get(`showed_calls_${funnelId}`));
    const qualifiedCalls = parseOptionalCountInput(formData.get(`qualified_calls_${funnelId}`));
    const sales = parseOptionalCountInput(formData.get(`sales_${funnelId}`));
    const newCustomers = parseOptionalCountInput(formData.get(`new_customers_${funnelId}`));
    const cashCollected = parseOptionalDecimalInput(formData.get(`cash_collected_${funnelId}`));
    const attributedRevenue = parseOptionalSignedDecimalInput(
      formData.get(`attributed_revenue_${funnelId}`),
    );

    if (
      !adSpend.ok ||
      !leads.ok ||
      !bookedCalls.ok ||
      !showedCalls.ok ||
      !qualifiedCalls.ok ||
      !sales.ok ||
      !newCustomers.ok ||
      !cashCollected.ok ||
      !attributedRevenue.ok
    ) {
      redirectFunnelMonthly(businessId, month.monthKey, "invalid-input", returnOrigin);
    }

    funnelEntries.push({
      funnel_id: funnelId,
      ad_spend: adSpend.value,
      leads: leads.value,
      booked_calls: bookedCalls.value,
      showed_calls: showedCalls.value,
      qualified_calls: qualifiedCalls.value,
      sales: sales.value,
      new_customers: newCustomers.value,
      cash_collected: cashCollected.value,
      attributed_revenue: attributedRevenue.value,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_funnel_monthly_actuals", {
    target_business_id: businessId,
    target_month_start: month.monthStart,
    target_business_ad_spend: businessAdSpend.value,
    target_funnel_entries: funnelEntries,
  });

  if (error) {
    redirectFunnelMonthly(businessId, month.monthKey, "save-failed", returnOrigin);
  }

  redirectFunnelMonthly(businessId, month.monthKey, "saved", returnOrigin);
}
