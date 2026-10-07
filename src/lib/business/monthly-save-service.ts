import "server-only";

import { requireAuthContext } from "@/lib/auth/context";
import {
  normalizeAdjustmentNote,
  parseMonthKey,
  parseOptionalCountInput,
  parseOptionalDecimalInput,
} from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { parseMonthlyExpenseInput } from "@/lib/business/monthly-expense-input";
import { isUncertainMonthlyWriteFailure } from "@/lib/business/monthly-write-outcome";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MonthlySaveErrorCode =
  | "invalid-input"
  | "invalid-month"
  | "invalid-customers"
  | "blank-month"
  | "historical-required"
  | "save-failed"
  | "save-uncertain";

export type MonthlySaveResult =
  | { ok: true; businessId: string; monthKey: string }
  | {
      ok: false;
      businessId: string | null;
      monthKey: string | null;
      code: MonthlySaveErrorCode;
      fieldErrors: Record<string, string>;
    };

type MonthlySaveOptions = {
  /** Only the new Setup flow supports omitting an entirely blank new per-customer row. */
  setupDraft?: boolean;
  /** Setup can independently re-read an exact month when transport loss makes write outcome unknowable. */
  recoverUncertainWrite?: boolean;
};

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

/** Shared validation and atomic persistence for Monthly and Setup; never trusts client row labels. */
export async function persistMonthlyActuals(
  formData: FormData,
  options: MonthlySaveOptions = {},
): Promise<MonthlySaveResult> {
  await requireAuthContext();
  const businessIds = formData.getAll("business_id");
  const months = formData.getAll("month");
  const businessId =
    businessIds.length === 1 ? parseResourceId(businessIds[0]) : null;
  const month = months.length === 1 ? parseMonthKey(months[0]) : null;

  const fail = (
    code: MonthlySaveErrorCode,
    fieldErrors: Record<string, string> = {},
  ): MonthlySaveResult => ({
    ok: false,
    businessId,
    monthKey: month?.monthKey ?? null,
    code,
    fieldErrors,
  });
  if (!businessId) return fail("invalid-input", { business_id: "معرّف البزنس غير صالح." });
  if (!month) return fail("invalid-month", { month: "الشهر غير صالح." });

  const fields: Record<string, string> = {};
  const newCustomers = parseOptionalCountInput(formData.get("new_customers"));
  const payingCustomers = parseOptionalCountInput(formData.get("total_paying_customers"));
  const unallocatedGross = parseOptionalDecimalInput(formData.get("unallocated_gross"));
  const unallocatedRefunds = parseOptionalDecimalInput(formData.get("unallocated_refunds"));
  const adjustmentNote = normalizeAdjustmentNote(formData.get("adjustment_note"));

  if (!newCustomers.ok) fields.new_customers = "أدخل عددًا صحيحًا غير سالب.";
  if (!payingCustomers.ok) fields.total_paying_customers = "أدخل عددًا صحيحًا غير سالب.";
  if (!unallocatedGross.ok) fields.unallocated_gross = "أدخل مبلغًا غير سالب.";
  if (!unallocatedRefunds.ok) fields.unallocated_refunds = "أدخل مبلغًا غير سالب.";
  if (adjustmentNote === null) fields.adjustment_note = "الحد الأقصى ٥٠٠ حرف.";
  if (Object.keys(fields).length) return fail("invalid-input", fields);

  // All parsed results have been checked above; retain nullable values without inventing zeroes.
  if (!newCustomers.ok || !payingCustomers.ok || !unallocatedGross.ok || !unallocatedRefunds.ok) {
    return fail("invalid-input");
  }
  if (
    newCustomers.value !== null &&
    payingCustomers.value !== null &&
    newCustomers.value > payingCustomers.value
  ) {
    return fail("invalid-customers", {
      new_customers: "العملاء الجدد لا يمكن أن يزيدوا عن إجمالي العملاء الدافعين.",
    });
  }

  const revenueIds = uniqueResourceIds(formData.getAll("revenue_stream_id"));
  const expenseIds = uniqueResourceIds(formData.getAll("expense_item_id"));
  if (!revenueIds || !expenseIds) return fail("invalid-input", {
    items: "تكرار أو معرّف غير صالح في مصادر الإيراد أو المصروفات.",
  });

  let meaningful =
    newCustomers.value !== null ||
    payingCustomers.value !== null ||
    unallocatedGross.value !== null ||
    unallocatedRefunds.value !== null;
  const revenueEntries: Array<{
    revenue_stream_id: string;
    gross_cash_collected: string | null;
    refunds: string | null;
  }> = [];
  for (const id of revenueIds) {
    const gross = parseOptionalDecimalInput(formData.get(`gross_${id}`));
    const refunds = parseOptionalDecimalInput(formData.get(`refund_${id}`));
    if (!gross.ok) fields[`gross_${id}`] = "أدخل مبلغًا صحيحًا غير سالب.";
    if (!refunds.ok) fields[`refund_${id}`] = "أدخل مبلغًا صحيحًا غير سالب.";
    if (!gross.ok || !refunds.ok) continue;
    if (gross.value !== null || refunds.value !== null) meaningful = true;
    revenueEntries.push({
      revenue_stream_id: id,
      gross_cash_collected: gross.value,
      refunds: refunds.value,
    });
  }

  const supabase = await createSupabaseServerClient();
  const existingExpenseBehavior = new Map<string, string>();
  const configuredExpenseBehavior = new Map<string, string>();
  const existingExpenseIds = new Set<string>();
  if (options.setupDraft && expenseIds.length) {
    const [configured, period] = await Promise.all([
      supabase.from("expense_items").select("id,cost_behavior")
        .eq("business_id", businessId).in("id", expenseIds),
      supabase.from("monthly_periods").select("id")
        .eq("business_id", businessId).eq("month_start", month.monthStart).maybeSingle(),
    ]);
    if (configured.error || period.error) return fail("save-failed");
    for (const item of configured.data ?? []) configuredExpenseBehavior.set(item.id, item.cost_behavior);
    if (configuredExpenseBehavior.size !== expenseIds.length) {
      return fail("invalid-input", { items: "بعض المصروفات لا تتبع هذا البزنس." });
    }
    if (period.data?.id) {
      const existing = await supabase.from("monthly_expense_entries")
        .select("expense_item_id,cost_behavior_snapshot")
        .eq("business_id", businessId)
        .eq("monthly_period_id", period.data.id)
        .in("expense_item_id", expenseIds);
      if (existing.error) return fail("save-failed");
      for (const entry of existing.data ?? []) {
        existingExpenseIds.add(entry.expense_item_id);
        existingExpenseBehavior.set(entry.expense_item_id, entry.cost_behavior_snapshot);
      }
    }
  }

  const expenseEntries: Array<{
    expense_item_id: string;
    display_value: string | null;
    customer_count_basis: "new_customers" | "total_paying_customers" | null;
  }> = [];
  for (const id of expenseIds) {
    const parsed = parseMonthlyExpenseInput({
      id,
      valueFields: formData.getAll(`expense_value_${id}`),
      basisFields: formData.getAll(`expense_basis_${id}`),
      behavior: existingExpenseBehavior.get(id) ?? configuredExpenseBehavior.get(id) ?? null,
      setupDraft: options.setupDraft === true,
      existingSavedRow: existingExpenseIds.has(id),
    });
    if (parsed.kind === "error") {
      fields[parsed.field] = parsed.message;
      continue;
    }
    if (parsed.kind === "skip") continue;
    if (parsed.entry.display_value !== null) meaningful = true;
    expenseEntries.push(parsed.entry);
  }
  if (Object.keys(fields).length) return fail("invalid-input", fields);
  if (options.setupDraft && !meaningful) return fail("blank-month", {
    month: "أدخل قيمة مالية أو عدد عملاء مؤكدًا قبل حفظ المسودة.",
  });

  const { error, status } = await supabase.rpc("save_monthly_actuals", {
    target_business_id: businessId,
    target_month_start: month.monthStart,
    target_new_customers: newCustomers.value,
    target_total_paying_customers: payingCustomers.value,
    target_unallocated_gross: unallocatedGross.value,
    target_unallocated_refunds: unallocatedRefunds.value,
    target_adjustment_note: adjustmentNote,
    target_revenue_entries: revenueEntries,
    target_expense_entries: expenseEntries,
  });
  if (error) {
    if (error.message.includes("explicit historical correction workflow")) {
      return fail("historical-required");
    }
    if (
      options.recoverUncertainWrite &&
      isUncertainMonthlyWriteFailure({ status, code: error.code })
    ) {
      return fail("save-uncertain");
    }
    return fail("save-failed");
  }
  return { ok: true, businessId, monthKey: month.monthKey };
}
