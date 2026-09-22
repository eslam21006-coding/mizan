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
import {
  parseMonthlyExternalReturnOrigin,
  type MonthlyExternalReturnOrigin,
} from "@/lib/monthly-return-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Reads only a safe cross-module origin from a Monthly form submission. */
function parseMonthlyReturnOrigin(formData: FormData): MonthlyExternalReturnOrigin | null {
  const origins = formData.getAll("origin");
  const returnMonths = formData.getAll("return_month");
  const months = formData.getAll("month");
  const insightRules = formData.getAll("insight_rule");
  const insightSubjects = formData.getAll("insight_subject");
  const plannerSteps = formData.getAll("planner_step");
  const plannerGoals = formData.getAll("planner_goal");
  const plannerValues = formData.getAll("planner_value");
  if (
    origins.length !== 1 ||
    returnMonths.length > 1 ||
    months.length > 1 ||
    insightRules.length > 1 ||
    insightSubjects.length > 1 ||
    plannerSteps.length > 1 ||
    plannerGoals.length > 1 ||
    plannerValues.length > 1
  ) {
    return null;
  }

  const rawOrigin = origins[0];
  const rawMonth = returnMonths.length === 1 ? returnMonths[0] : months[0];
  const rawInsightRule = insightRules[0];
  const rawInsightSubject = insightSubjects[0];
  const rawPlannerStep = plannerSteps[0];
  const rawPlannerGoal = plannerGoals[0];
  const rawPlannerValue = plannerValues[0];
  if (
    typeof rawOrigin !== "string" ||
    typeof rawMonth !== "string" ||
    (rawInsightRule !== undefined && typeof rawInsightRule !== "string") ||
    (rawInsightSubject !== undefined && typeof rawInsightSubject !== "string") ||
    (rawPlannerStep !== undefined && typeof rawPlannerStep !== "string") ||
    (rawPlannerGoal !== undefined && typeof rawPlannerGoal !== "string") ||
    (rawPlannerValue !== undefined && typeof rawPlannerValue !== "string")
  ) {
    return null;
  }
  return parseMonthlyExternalReturnOrigin({
    origin: rawOrigin,
    month: rawMonth,
    insight_rule: rawInsightRule,
    insight_subject: rawInsightSubject,
    planner_step: rawPlannerStep,
    planner_goal: rawPlannerGoal,
    planner_value: rawPlannerValue,
  });
}

/** Builds the canonical monthly-entry URL with status, copy-result, and safe workflow-origin query parameters. */
function monthlyPath(
  businessId: string,
  monthKey: string,
  status?: string,
  copied?: number,
  returnOrigin?: MonthlyExternalReturnOrigin | null,
) {
  const query = new URLSearchParams({ month: monthKey });
  if (status) query.set("status", status);
  if (copied !== undefined) query.set("copied", String(copied));
  if (returnOrigin) {
    query.set("origin", returnOrigin.origin);
    if (
      (returnOrigin.origin === "customer-profitability" ||
        returnOrigin.origin === "insights") &&
      returnOrigin.month
    ) {
      query.set("return_month", returnOrigin.month);
    }
    if (returnOrigin.origin === "insights") {
      query.set("insight_rule", returnOrigin.ruleId);
      if (returnOrigin.subjectId) query.set("insight_subject", returnOrigin.subjectId);
    }
    if (returnOrigin.origin === "target-planner") {
      query.set("planner_step", returnOrigin.step);
      query.set("planner_goal", returnOrigin.goal);
      if (returnOrigin.value !== undefined) query.set("planner_value", returnOrigin.value);
    }
  }
  return `/businesses/${businessId}/monthly?${query.toString()}`;
}

/** Builds the explicit audited-correction URL for an existing historical month. */
function historicalCorrectionPath(
  businessId: string,
  monthKey: string,
  returnOrigin?: MonthlyExternalReturnOrigin | null,
) {
  const query = new URLSearchParams({ month: monthKey, status: "historical-required" });
  if (returnOrigin) {
    query.set("origin", returnOrigin.origin);
    if (
      (returnOrigin.origin === "customer-profitability" ||
        returnOrigin.origin === "insights") &&
      returnOrigin.month
    ) {
      query.set("return_month", returnOrigin.month);
    }
    if (returnOrigin.origin === "insights") {
      query.set("insight_rule", returnOrigin.ruleId);
      if (returnOrigin.subjectId) query.set("insight_subject", returnOrigin.subjectId);
    }
    if (returnOrigin.origin === "target-planner") {
      query.set("planner_step", returnOrigin.step);
      query.set("planner_goal", returnOrigin.goal);
      if (returnOrigin.value !== undefined) query.set("planner_value", returnOrigin.value);
    }
  }
  return `/businesses/${businessId}/monthly/correction?${query.toString()}`;
}

/** Sends a rejected normal historical write to the explicit audited correction workflow. */
function redirectHistoricalCorrection(
  businessId: string,
  monthKey: string,
  returnOrigin?: MonthlyExternalReturnOrigin | null,
): never {
  revalidatePath(`/businesses/${businessId}/monthly`);
  revalidatePath("/insights");
  revalidatePath("/target-plan");
  redirect(historicalCorrectionPath(businessId, monthKey, returnOrigin));
}

/** Revalidates monthly views and redirects to the selected month with a status code and safe workflow origin. */
function redirectMonthly(
  businessId: string,
  monthKey: string,
  status: string,
  returnOrigin?: MonthlyExternalReturnOrigin | null,
): never {
  revalidatePath("/businesses");
  revalidatePath("/insights");
  revalidatePath("/target-plan");
  revalidatePath(`/businesses/${businessId}/monthly`);
  redirect(monthlyPath(businessId, monthKey, status, undefined, returnOrigin));
}

/** Parses a submitted resource-id list and rejects duplicates or malformed identifiers. */
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

/** Validates and atomically persists one month's actual revenue, expenses, and customer inputs. */
export async function saveMonthlyActuals(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const month = parseMonthKey(formData.get("month"));

  if (!businessId) redirect("/businesses");
  if (!month) redirect(`/businesses/${businessId}/monthly?status=invalid-month`);

  const returnOrigin = parseMonthlyReturnOrigin(formData);
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
    redirectMonthly(businessId, month.monthKey, "invalid-input", returnOrigin);
  }

  if (
    newCustomers.value !== null &&
    payingCustomers.value !== null &&
    newCustomers.value > payingCustomers.value
  ) {
    redirectMonthly(businessId, month.monthKey, "invalid-customers", returnOrigin);
  }

  const revenueStreamIds = uniqueResourceIds(formData.getAll("revenue_stream_id"));
  const expenseItemIds = uniqueResourceIds(formData.getAll("expense_item_id"));
  if (!revenueStreamIds || !expenseItemIds) {
    redirectMonthly(businessId, month.monthKey, "invalid-input", returnOrigin);
  }

  const revenueEntries = [];
  for (const streamId of revenueStreamIds) {
    const gross = parseOptionalDecimalInput(formData.get(`gross_${streamId}`));
    const refunds = parseOptionalDecimalInput(formData.get(`refund_${streamId}`));
    if (!gross.ok || !refunds.ok) {
      redirectMonthly(businessId, month.monthKey, "invalid-input", returnOrigin);
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
      redirectMonthly(businessId, month.monthKey, "invalid-input", returnOrigin);
    }

    const rawBasis = String(formData.get(`expense_basis_${expenseId}`) ?? "").trim();
    const basis = rawBasis ? parseCustomerCountBasis(rawBasis) : null;
    if (rawBasis && !basis) {
      redirectMonthly(businessId, month.monthKey, "invalid-input", returnOrigin);
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
    target_unallocated_gross: unallocatedGross.value,
    target_unallocated_refunds: unallocatedRefunds.value,
    target_adjustment_note: adjustmentNote,
    target_revenue_entries: revenueEntries,
    target_expense_entries: expenseEntries,
  });

  if (error) {
    if (error.message.includes("explicit historical correction workflow")) {
      redirectHistoricalCorrection(businessId, month.monthKey, returnOrigin);
    }
    redirectMonthly(businessId, month.monthKey, "save-failed", returnOrigin);
  }

  redirectMonthly(businessId, month.monthKey, "saved", returnOrigin);
}

/** Copies the previous month's expense inputs into the selected month without changing other actuals. */
export async function copyPreviousMonthExpenses(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const month = parseMonthKey(formData.get("month"));
  if (!businessId) redirect("/businesses");
  if (!month) redirect(`/businesses/${businessId}/monthly?status=invalid-month`);

  const returnOrigin = parseMonthlyReturnOrigin(formData);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("copy_previous_month_expenses", {
    target_business_id: businessId,
    target_month_start: month.monthStart,
  });

  if (error) {
    if (error.message.includes("explicit historical correction workflow")) {
      redirectHistoricalCorrection(businessId, month.monthKey, returnOrigin);
    }
    redirectMonthly(businessId, month.monthKey, "copy-failed", returnOrigin);
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.previous_month_found) {
    redirectMonthly(businessId, month.monthKey, "no-previous", returnOrigin);
  }

  const copiedCount = Number(result.copied_count ?? 0);
  revalidatePath(`/businesses/${businessId}/monthly`);
  redirect(monthlyPath(businessId, month.monthKey, "copied", copiedCount, returnOrigin));
}