"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { parseOptionalDecimalInput } from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function reviewPath(businessId: string, status?: string) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return `/businesses/${businessId}/customers/review${suffix}`;
}

function redirectReview(businessId: string, status: string): never {
  revalidatePath(`/businesses/${businessId}/customers`);
  revalidatePath(`/businesses/${businessId}/customers/review`);
  redirect(reviewPath(businessId, status));
}

function parseReason(value: FormDataEntryValue | null) {
  const reason = String(value ?? "").trim();
  return reason.length >= 1 && reason.length <= 500 ? reason : null;
}

function parseCohortMonth(value: FormDataEntryValue) {
  const candidate = String(value).trim();
  return /^\d{4}-\d{2}-01$/.test(candidate) ? candidate : null;
}

function uniqueResourceIds(values: FormDataEntryValue[]) {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const id = parseResourceId(value);
    if (!id || seen.has(id)) return null;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

/** Redistributes one unresolved authoritative cost pool across trusted first-purchase months. */
export async function saveCustomerEconomicsManualOverride(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const sourceId = parseResourceId(formData.get("authoritative_source_id"));
  if (!businessId) redirect("/businesses");
  if (!sourceId) redirectReview(businessId, "invalid-input");

  const reason = parseReason(formData.get("reason"));
  const cohortMonths = formData.getAll("cohort_month");
  const allocationAmounts = formData.getAll("allocation_amount");
  if (!reason || cohortMonths.length === 0 || cohortMonths.length !== allocationAmounts.length) {
    redirectReview(businessId, "invalid-input");
  }

  const allocations: Array<{ cohort_month: string; amount: string }> = [];
  const seenMonths = new Set<string>();

  for (let index = 0; index < cohortMonths.length; index += 1) {
    const cohortMonth = parseCohortMonth(cohortMonths[index]);
    const amount = parseOptionalDecimalInput(allocationAmounts[index]);
    if (!cohortMonth || !amount.ok) redirectReview(businessId, "invalid-input");
    if (seenMonths.has(cohortMonth)) redirectReview(businessId, "invalid-input");
    seenMonths.add(cohortMonth);

    if (amount.value === null || amount.value === "0") continue;
    allocations.push({ cohort_month: cohortMonth, amount: amount.value });
  }

  if (allocations.length === 0) redirectReview(businessId, "invalid-input");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_customer_economics_manual_override", {
    p_business_id: businessId,
    p_authoritative_source_id: sourceId,
    p_allocations: allocations,
    p_reason: reason,
  });

  if (error) redirectReview(businessId, "override-failed");
  redirectReview(businessId, "override-saved");
}

/** Reconciles preserved legacy manual rows to one existing authoritative historical cost pool. */
export async function reconcileCustomerEconomicsLegacyAllocations(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const sourceId = parseResourceId(formData.get("authoritative_source_id"));
  if (!businessId) redirect("/businesses");
  if (!sourceId) redirectReview(businessId, "invalid-input");

  const reason = parseReason(formData.get("reason"));
  const legacyIds = uniqueResourceIds(formData.getAll("legacy_allocation_id"));
  if (!reason || !legacyIds || legacyIds.length === 0) {
    redirectReview(businessId, "invalid-input");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reconcile_customer_economics_legacy_allocations", {
    p_business_id: businessId,
    p_authoritative_source_id: sourceId,
    p_legacy_allocation_ids: legacyIds,
    p_reason: reason,
  });

  if (error) redirectReview(businessId, "legacy-failed");
  redirectReview(businessId, "legacy-reconciled");
}
