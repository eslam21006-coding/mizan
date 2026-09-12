"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import {
  normalizeAdjustmentNote,
  parseCustomerCountBasis,
  parseMonthKey,
  parseOptionalCountInput,
  parseOptionalDecimalInput,
} from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function correctionPath(businessId: string, monthKey: string, status?: string) {
  const query = new URLSearchParams({ month: monthKey });
  if (status) query.set("status", status);
  return `/businesses/${businessId}/monthly/correction?${query.toString()}`;
}

function redirectCorrection(businessId: string, monthKey: string, status: string): never {
  revalidatePath(`/businesses/${businessId}/monthly`);
  revalidatePath(`/businesses/${businessId}/monthly/correction`);
  revalidatePath(`/businesses/${businessId}/customers`);
  revalidatePath(`/businesses/${businessId}/customers/review`);
  redirect(correctionPath(businessId, monthKey, status));
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

/** Corrects an existing historical month through the audited database-only correction workflow. */
export async function correctHistoricalMonthlyActuals(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const month = parseMonthKey(formData.get("month"));
  if (!businessId) redirect("/businesses");
  if (!month) redirect(`/businesses/${businessId}/monthly/correction?status=invalid-month`);

  const correctionReason = String(formData.get("correction_reason") ?? "").trim();
  const newCustomers = parseOptionalCountInput(formData.get("new_customers"));
  const payingCustomers = parseOptionalCountInput(formData.get("total_paying_customers"));
  const unallocatedGross = parseOptionalDecimalInput(formData.get("unallocated_gross"));
  const unallocatedRefunds = parseOptionalDecimalInput(formData.get("unallocated_refunds"));
  const adjustmentNote = normalizeAdjustmentNote(formData.get("adjustment_note"));

  if (
    correctionReason.length < 1 ||
    correctionReason.length > 500 ||
    !newCustomers.ok ||
    !payingCustomers.ok ||
    !unallocatedGross.ok ||
    !unallocatedRefunds.ok ||
    adjustmentNote === null
  ) {
    redirectCorrection(businessId, month.monthKey, "invalid-input");
  }

  if (
    newCustomers.value !== null &&
    payingCustomers.value !== null &&
    newCustomers.value > payingCustomers.value
  ) {
    redirectCorrection(businessId, month.monthKey, "invalid-customers");
  }

  const revenueStreamIds = uniqueResourceIds(formData.getAll("revenue_stream_id"));
  const expenseItemIds = uniqueResourceIds(formData.getAll("expense_item_id"));
  if (!revenueStreamIds || !expenseItemIds) {
    redirectCorrection(businessId, month.monthKey, "invalid-input");
  }

  const revenueEntries = [];
  for (const streamId of revenueStreamIds) {
    const gross = parseOptionalDecimalInput(formData.get(`gross_${streamId}`));
    const refunds = parseOptionalDecimalInput(formData.get(`refund_${streamId}`));
    if (!gross.ok || !refunds.ok) {
      redirectCorrection(businessId, month.monthKey, "invalid-input");
    }

    revenueEntries.push({
      revenue_stream_id: streamId,
      gross_cash_collected: gross.value,
      refunds: refunds.value,
    });
  }

  const expenseEntries = [];
  for (const expenseId of expenseItemIds) {
    const displayValue = parseOptionalDecimalInput(formData.get(`expense_value_${expenseId}`));
    if (!displayValue.ok) {
      redirectCorrection(businessId, month.monthKey, "invalid-input");
    }

    const rawBasis = String(formData.get(`expense_basis_${expenseId}`) ?? "").trim();
    const basis = rawBasis ? parseCustomerCountBasis(rawBasis) : null;
    if (rawBasis && !basis) {
      redirectCorrection(businessId, month.monthKey, "invalid-input");
    }

    expenseEntries.push({
      expense_item_id: expenseId,
      display_value: displayValue.value,
      customer_count_basis: basis,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("correct_historical_monthly_actuals", {
    target_business_id: businessId,
    target_month_start: month.monthStart,
    target_new_customers: newCustomers.value,
    target_total_paying_customers: payingCustomers.value,
    target_unallocated_gross: unallocatedGross.value,
    target_unallocated_refunds: unallocatedRefunds.value,
    target_adjustment_note: adjustmentNote,
    target_revenue_entries: revenueEntries,
    target_expense_entries: expenseEntries,
    target_correction_reason: correctionReason,
  });

  if (error) redirectCorrection(businessId, month.monthKey, "correction-failed");
  redirectCorrection(businessId, month.monthKey, "corrected");
}
