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

function monthlyPath(
  businessId: string,
  monthKey: string,
  status?: string,
  copied?: number,
) {
  const query = new URLSearchParams({ month: monthKey });
  if (status) query.set("status", status);
  if (copied !== undefined) query.set("copied", String(copied));
  return `/businesses/${businessId}/monthly?${query.toString()}`;
}

function redirectMonthly(businessId: string, monthKey: string, status: string): never {
  revalidatePath("/businesses");
  revalidatePath(`/businesses/${businessId}/monthly`);
  redirect(monthlyPath(businessId, monthKey, status));
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

export async function saveMonthlyActuals(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const month = parseMonthKey(formData.get("month"));

  if (!businessId) redirect("/businesses");
  if (!month) redirect(`/businesses/${businessId}/monthly?status=invalid-month`);

  const newCustomers = parseOptionalCountInput(formData.get("new_customers"));
  const payingCustomers = parseOptionalCountInput(formData.get("total_paying_customers"));
  const unallocatedGross = parseOptionalDecimalInput(formData.get("unallocated_gross"));
  const unallocatedRefunds = parseOptionalDecimalInput(formData.get("unallocated_refunds"));
  const adjustmentNote = normalizeAdjustmentNote(formData.get("adjustment_note"));

  if (
    !newCustomers.ok ||
    !payingCustomers.ok ||
    !unallocatedGross.ok ||
    !unallocatedRefunds.ok ||
    adjustmentNote === null
  ) {
    redirectMonthly(businessId, month.monthKey, "invalid-input");
  }

  if (
    newCustomers.value !== null &&
    payingCustomers.value !== null &&
    newCustomers.value > payingCustomers.value
  ) {
    redirectMonthly(businessId, month.monthKey, "invalid-customers");
  }

  const revenueStreamIds = uniqueResourceIds(formData.getAll("revenue_stream_id"));
  const expenseItemIds = uniqueResourceIds(formData.getAll("expense_item_id"));
  if (!revenueStreamIds || !expenseItemIds) {
    redirectMonthly(businessId, month.monthKey, "invalid-input");
  }

  const revenueEntries = [];
  for (const streamId of revenueStreamIds) {
    const gross = parseOptionalDecimalInput(formData.get(`gross_${streamId}`));
    const refunds = parseOptionalDecimalInput(formData.get(`refund_${streamId}`));
    if (!gross.ok || !refunds.ok) {
      redirectMonthly(businessId, month.monthKey, "invalid-input");
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
      redirectMonthly(businessId, month.monthKey, "invalid-input");
    }

    const rawBasis = String(formData.get(`expense_basis_${expenseId}`) ?? "").trim();
    const basis = rawBasis ? parseCustomerCountBasis(rawBasis) : null;
    if (rawBasis && !basis) {
      redirectMonthly(businessId, month.monthKey, "invalid-input");
    }

    expenseEntries.push({
      expense_item_id: expenseId,
      display_value: displayValue.value,
      customer_count_basis: basis,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_monthly_actuals", {
    target_business_id: businessId,
    target_month_start: month.monthStart,
    target_new_customers: newCustomers.value,
    target_total_paying_customers: payingCustomers.value,
    target_unallocated_gross: unallocatedGross.value ?? "0",
    target_unallocated_refunds: unallocatedRefunds.value ?? "0",
    target_adjustment_note: adjustmentNote,
    target_revenue_entries: revenueEntries,
    target_expense_entries: expenseEntries,
  });

  if (error) {
    redirectMonthly(businessId, month.monthKey, "save-failed");
  }

  redirectMonthly(businessId, month.monthKey, "saved");
}

export async function copyPreviousMonthExpenses(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const month = parseMonthKey(formData.get("month"));
  if (!businessId) redirect("/businesses");
  if (!month) redirect(`/businesses/${businessId}/monthly?status=invalid-month`);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("copy_previous_month_expenses", {
    target_business_id: businessId,
    target_month_start: month.monthStart,
  });

  if (error) {
    redirectMonthly(businessId, month.monthKey, "copy-failed");
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.previous_month_found) {
    redirectMonthly(businessId, month.monthKey, "no-previous");
  }

  const copiedCount = Number(result.copied_count ?? 0);
  revalidatePath(`/businesses/${businessId}/monthly`);
  redirect(monthlyPath(businessId, month.monthKey, "copied", copiedCount));
}
