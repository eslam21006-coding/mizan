"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { parseMonthKey, parseOptionalDecimalInput } from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function liquidationPath(businessId: string, monthKey: string, status?: string) {
  const query = new URLSearchParams({ month: monthKey });
  if (status) query.set("status", status);
  return `/businesses/${businessId}/liquidation?${query.toString()}`;
}

function redirectLiquidation(businessId: string, monthKey: string, status: string): never {
  revalidatePath(`/businesses/${businessId}/liquidation`);
  redirect(liquidationPath(businessId, monthKey, status));
}

export async function saveFrontEndAllocations(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const month = parseMonthKey(formData.get("month"));

  if (!businessId) redirect("/businesses");
  if (!month) redirect(`/businesses/${businessId}/liquidation?status=invalid-month`);

  const rawEntryIds = formData.getAll("monthly_expense_entry_id");
  const entryIds: string[] = [];
  const seen = new Set<string>();

  for (const rawId of rawEntryIds) {
    const entryId = parseResourceId(rawId);
    if (!entryId || seen.has(entryId)) {
      redirectLiquidation(businessId, month.monthKey, "invalid-input");
    }
    seen.add(entryId);
    entryIds.push(entryId);
  }

  const allocations = [];
  for (const entryId of entryIds) {
    const allocation = parseOptionalDecimalInput(formData.get(`allocation_${entryId}`));
    if (!allocation.ok) {
      redirectLiquidation(businessId, month.monthKey, "invalid-input");
    }
    allocations.push({
      monthly_expense_entry_id: entryId,
      allocated_amount: allocation.value,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_front_end_expense_allocations", {
    target_business_id: businessId,
    target_month_start: month.monthStart,
    target_allocations: allocations,
  });

  if (error) {
    redirectLiquidation(businessId, month.monthKey, "save-failed");
  }

  redirectLiquidation(businessId, month.monthKey, "saved");
}
