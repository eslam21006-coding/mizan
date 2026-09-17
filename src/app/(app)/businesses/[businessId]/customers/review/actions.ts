"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { parseOptionalDecimalInput } from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { parseReturnOrigin, type ReturnOriginMetadata } from "@/lib/return-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfitabilityReturnOrigin = Extract<
  ReturnOriginMetadata,
  { origin: "customer-profitability" }
>;

/** Reads only the allow-listed profitability origin from a Review mutation submission. */
function parseReviewReturnOrigin(formData: FormData): ProfitabilityReturnOrigin | null {
  const rawOrigin = formData.get("origin");
  if (typeof rawOrigin !== "string") return null;
  const parsed = parseReturnOrigin({ origin: rawOrigin });
  return parsed?.origin === "customer-profitability" ? parsed : null;
}

/** Builds the canonical Customer Review URL with status and safe workflow-origin metadata. */
function reviewPath(
  businessId: string,
  status?: string,
  returnOrigin?: ProfitabilityReturnOrigin | null,
) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (returnOrigin) query.set("origin", returnOrigin.origin);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return `/businesses/${businessId}/customers/review${suffix}`;
}

/** Revalidates Customer Economics and returns to Review while preserving a validated origin. */
function redirectReview(
  businessId: string,
  status: string,
  returnOrigin?: ProfitabilityReturnOrigin | null,
): never {
  revalidatePath(`/businesses/${businessId}/customers`);
  revalidatePath(`/businesses/${businessId}/customers/review`);
  redirect(reviewPath(businessId, status, returnOrigin));
}

/** Validates founder review reasoning text without normalizing empty input into a value. */
function parseReason(value: FormDataEntryValue | null) {
  const reason = String(value ?? "").trim();
  return reason.length >= 1 && reason.length <= 500 ? reason : null;
}

/** Accepts only canonical first-of-month cohort dates used by Customer Economics. */
function parseCohortMonth(value: FormDataEntryValue) {
  const candidate = String(value).trim();
  return /^\d{4}-\d{2}-01$/.test(candidate) ? candidate : null;
}

/** Parses a duplicate-free list of resource identifiers for legacy reconciliation. */
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
  const returnOrigin = parseReviewReturnOrigin(formData);
  if (!sourceId) redirectReview(businessId, "invalid-input", returnOrigin);

  const reason = parseReason(formData.get("reason"));
  const cohortMonths = formData.getAll("cohort_month");
  const allocationAmounts = formData.getAll("allocation_amount");
  if (!reason || cohortMonths.length === 0 || cohortMonths.length !== allocationAmounts.length) {
    redirectReview(businessId, "invalid-input", returnOrigin);
  }

  const allocations: Array<{ cohort_month: string; amount: string }> = [];
  const seenMonths = new Set<string>();

  for (let index = 0; index < cohortMonths.length; index += 1) {
    const cohortMonth = parseCohortMonth(cohortMonths[index]);
    const amount = parseOptionalDecimalInput(allocationAmounts[index]);
    if (!cohortMonth || !amount.ok) redirectReview(businessId, "invalid-input", returnOrigin);
    if (seenMonths.has(cohortMonth)) redirectReview(businessId, "invalid-input", returnOrigin);
    seenMonths.add(cohortMonth);

    if (amount.value === null || amount.value === "0") continue;
    allocations.push({ cohort_month: cohortMonth, amount: amount.value });
  }

  if (allocations.length === 0) redirectReview(businessId, "invalid-input", returnOrigin);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_customer_economics_manual_override", {
    p_business_id: businessId,
    p_authoritative_source_id: sourceId,
    p_allocations: allocations,
    p_reason: reason,
  });

  if (error) redirectReview(businessId, "override-failed", returnOrigin);
  redirectReview(businessId, "override-saved", returnOrigin);
}

/** Reconciles preserved legacy manual rows to one existing authoritative historical cost pool. */
export async function reconcileCustomerEconomicsLegacyAllocations(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const sourceId = parseResourceId(formData.get("authoritative_source_id"));
  if (!businessId) redirect("/businesses");
  const returnOrigin = parseReviewReturnOrigin(formData);
  if (!sourceId) redirectReview(businessId, "invalid-input", returnOrigin);

  const reason = parseReason(formData.get("reason"));
  const legacyIds = uniqueResourceIds(formData.getAll("legacy_allocation_id"));
  if (!reason || !legacyIds || legacyIds.length === 0) {
    redirectReview(businessId, "invalid-input", returnOrigin);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reconcile_customer_economics_legacy_allocations", {
    p_business_id: businessId,
    p_authoritative_source_id: sourceId,
    p_legacy_allocation_ids: legacyIds,
    p_reason: reason,
  });

  if (error) redirectReview(businessId, "legacy-failed", returnOrigin);
  redirectReview(businessId, "legacy-reconciled", returnOrigin);
}
