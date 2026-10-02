"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { parseMonthKey } from "@/lib/business/monthly";
import { persistMonthlyActuals } from "@/lib/business/monthly-save-service";
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

/** Preserves the established Monthly destination while using the same validated save as Setup. */
export async function saveMonthlyActuals(formData: FormData) {
  const returnOrigin = parseMonthlyReturnOrigin(formData);
  const result = await persistMonthlyActuals(formData);
  if (!result.businessId) redirect("/businesses");
  if (!result.monthKey) {
    redirect(`/businesses/${result.businessId}/monthly?status=invalid-month`);
  }
  if (!result.ok) {
    if (result.code === "historical-required") {
      redirectHistoricalCorrection(result.businessId, result.monthKey, returnOrigin);
    }
    redirectMonthly(result.businessId, result.monthKey, result.code, returnOrigin);
  }
  redirectMonthly(result.businessId, result.monthKey, "saved", returnOrigin);
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
  revalidatePath("/target-plan");
  redirect(monthlyPath(businessId, month.monthKey, "copied", copiedCount, returnOrigin));
}