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
import { createSupabaseServerClient } from "@/lib/supabase/server";

function funnelMonthlyPath(businessId: string, monthKey: string, status?: string) {
  const query = new URLSearchParams({ month: monthKey });
  if (status) query.set("status", status);
  return `/businesses/${businessId}/funnels/monthly?${query.toString()}`;
}

function redirectFunnelMonthly(businessId: string, monthKey: string, status: string): never {
  revalidatePath("/");
  revalidatePath("/analytics");
  revalidatePath(`/businesses/${businessId}/funnels/monthly`);
  redirect(funnelMonthlyPath(businessId, monthKey, status));
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
  if (!businessId) redirect("/businesses");
  if (!month) redirect(`/businesses/${businessId}/funnels/monthly?status=invalid-month`);

  const businessAdSpend = parseOptionalDecimalInput(formData.get("business_ad_spend"));
  if (!businessAdSpend.ok) {
    redirectFunnelMonthly(businessId, month.monthKey, "invalid-input");
  }

  const funnelIds = uniqueFunnelIds(formData.getAll("funnel_id"));
  if (!funnelIds) {
    redirectFunnelMonthly(businessId, month.monthKey, "invalid-input");
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
      redirectFunnelMonthly(businessId, month.monthKey, "invalid-input");
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
    redirectFunnelMonthly(businessId, month.monthKey, "save-failed");
  }

  redirectFunnelMonthly(businessId, month.monthKey, "saved");
}
