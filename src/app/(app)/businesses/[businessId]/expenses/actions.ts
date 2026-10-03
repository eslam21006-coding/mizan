"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import {
  normalizeExpenseName,
  parseExpenseCategory,
  parseExpenseCostBehavior,
} from "@/lib/business/expenses";
import { parseActiveState, parseResourceId } from "@/lib/business/revenue-streams";
import { buildBusinessSetupHref } from "@/lib/business/setup-navigation";
import {
  parseSetupReturnOrigin,
  type SetupReturnOrigin,
} from "@/lib/setup-return-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ExpenseMutationDestination = "workspace" | "setup";

/** Accepts only the two internal destinations supported by expense creation. */
function parseExpenseMutationDestination(formData: FormData): ExpenseMutationDestination | null {
  const values = formData.getAll("destination");
  if (values.length === 0) return "workspace";
  if (values.length !== 1 || typeof values[0] !== "string") return null;
  return values[0] === "workspace" || values[0] === "setup" ? values[0] : null;
}

/** Builds the canonical B07 Expenses setup URL with a founder-facing result status. */
function setupExpensesPath(businessId: string, status: string) {
  return `${buildBusinessSetupHref(businessId, "expenses")}&status=${encodeURIComponent(status)}`;
}

/** Parses and validates the structured Monthly/setup return origin carried by expense mutations. */
function parseExpenseSetupReturnOrigin(formData: FormData): SetupReturnOrigin | null {
  const origins = formData.getAll("origin");
  const months = formData.getAll("month");
  const upstreamOrigins = formData.getAll("upstream_origin");
  const upstreamMonths = formData.getAll("upstream_month");
  const upstreamInsightRules = formData.getAll("upstream_insight_rule");
  const upstreamInsightSubjects = formData.getAll("upstream_insight_subject");
  const upstreamPlannerSteps = formData.getAll("upstream_planner_step");
  const upstreamPlannerGoals = formData.getAll("upstream_planner_goal");
  const upstreamPlannerValues = formData.getAll("upstream_planner_value");

  if (
    origins.length !== 1 ||
    months.length !== 1 ||
    upstreamOrigins.length > 1 ||
    upstreamMonths.length > 1 ||
    upstreamInsightRules.length > 1 ||
    upstreamInsightSubjects.length > 1 ||
    upstreamPlannerSteps.length > 1 ||
    upstreamPlannerGoals.length > 1 ||
    upstreamPlannerValues.length > 1
  ) {
    return null;
  }

  const origin = origins[0];
  const month = months[0];
  const upstreamOrigin = upstreamOrigins[0];
  const upstreamMonth = upstreamMonths[0];
  const upstreamInsightRule = upstreamInsightRules[0];
  const upstreamInsightSubject = upstreamInsightSubjects[0];
  const upstreamPlannerStep = upstreamPlannerSteps[0];
  const upstreamPlannerGoal = upstreamPlannerGoals[0];
  const upstreamPlannerValue = upstreamPlannerValues[0];
  if (
    typeof origin !== "string" ||
    typeof month !== "string" ||
    (upstreamOrigin !== undefined && typeof upstreamOrigin !== "string") ||
    (upstreamMonth !== undefined && typeof upstreamMonth !== "string") ||
    (upstreamInsightRule !== undefined && typeof upstreamInsightRule !== "string") ||
    (upstreamInsightSubject !== undefined && typeof upstreamInsightSubject !== "string") ||
    (upstreamPlannerStep !== undefined && typeof upstreamPlannerStep !== "string") ||
    (upstreamPlannerGoal !== undefined && typeof upstreamPlannerGoal !== "string") ||
    (upstreamPlannerValue !== undefined && typeof upstreamPlannerValue !== "string")
  ) {
    return null;
  }

  return parseSetupReturnOrigin({
    origin,
    month,
    upstream_origin: upstreamOrigin,
    upstream_month: upstreamMonth,
    upstream_insight_rule: upstreamInsightRule,
    upstream_insight_subject: upstreamInsightSubject,
    upstream_planner_step: upstreamPlannerStep,
    upstream_planner_goal: upstreamPlannerGoal,
    upstream_planner_value: upstreamPlannerValue,
  });
}

function expensesPath(
  businessId: string,
  status: string,
  returnOrigin?: SetupReturnOrigin | null,
) {
  const query = new URLSearchParams({ status });
  if (returnOrigin) {
    query.set("origin", returnOrigin.origin);
    query.set("month", returnOrigin.month);
    if (returnOrigin.upstream) {
      query.set("upstream_origin", returnOrigin.upstream.origin);
      if (
        (returnOrigin.upstream.origin === "customer-profitability" ||
          returnOrigin.upstream.origin === "insights") &&
        returnOrigin.upstream.month
      ) {
        query.set("upstream_month", returnOrigin.upstream.month);
      }
      if (returnOrigin.upstream.origin === "insights") {
        query.set("upstream_insight_rule", returnOrigin.upstream.ruleId);
        if (returnOrigin.upstream.subjectId) {
          query.set("upstream_insight_subject", returnOrigin.upstream.subjectId);
        }
      }
      if (returnOrigin.upstream.origin === "target-planner") {
        query.set("upstream_planner_step", returnOrigin.upstream.step);
        query.set("upstream_planner_goal", returnOrigin.upstream.goal);
        if (returnOrigin.upstream.value !== undefined) {
          query.set("upstream_planner_value", returnOrigin.upstream.value);
        }
      }
    }
  }
  return `/businesses/${businessId}/expenses?${query.toString()}`;
}

/** Revalidates every surface affected by an expense mutation before returning to setup. */
function redirectToExpenses(
  businessId: string,
  status: string,
  returnOrigin?: SetupReturnOrigin | null,
): never {
  revalidatePath("/businesses");
  revalidatePath("/insights");
  revalidatePath("/target-plan");
  revalidatePath(`/businesses/${businessId}/expenses`);
  revalidatePath(`/businesses/${businessId}/monthly`);
  redirect(expensesPath(businessId, status, returnOrigin));
}

/** Revalidates expense-dependent surfaces and returns creation to its allow-listed destination. */
function redirectAfterExpenseCreation(
  businessId: string,
  status: string,
  destination: ExpenseMutationDestination,
  returnOrigin?: SetupReturnOrigin | null,
): never {
  if (destination === "setup") {
    revalidatePath("/businesses");
    revalidatePath(`/businesses/${businessId}`);
    revalidatePath(`/businesses/${businessId}/expenses`);
    revalidatePath(`/businesses/${businessId}/monthly`);
    revalidatePath(buildBusinessSetupHref(businessId));
    redirect(setupExpensesPath(businessId, status));
  }

  redirectToExpenses(businessId, status, returnOrigin);
}

export async function createExpenseItem(formData: FormData) {
  await requireAuthContext();

  const destination = parseExpenseMutationDestination(formData);
  const returnOrigin = destination === "workspace" ? parseExpenseSetupReturnOrigin(formData) : null;

  const businessId = parseResourceId(formData.get("business_id"));
  const name = normalizeExpenseName(formData.get("name"));
  const category = parseExpenseCategory(formData.get("category"));
  const costBehavior = parseExpenseCostBehavior(formData.get("cost_behavior"));
  const creationRequestId = parseResourceId(formData.get("creation_request_id"));

  if (!businessId) {
    redirect("/businesses");
  }

  if (!destination || !name || !category || !costBehavior || !creationRequestId) {
    const invalidDestination = destination ?? "workspace";
    redirect(
      invalidDestination === "setup"
        ? setupExpensesPath(businessId, "invalid")
        : expensesPath(businessId, "invalid", returnOrigin),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("expense_items").insert({
    business_id: businessId,
    name,
    category,
    cost_behavior: costBehavior,
    creation_request_id: creationRequestId,
  });

  if (!error || error.code === "23505") {
    return redirectAfterExpenseCreation(businessId, "created", destination, returnOrigin);
  }

  redirect(
    destination === "setup"
      ? setupExpensesPath(businessId, "create-failed")
      : expensesPath(businessId, "create-failed", returnOrigin),
  );
}

export async function updateExpenseItem(formData: FormData) {
  await requireAuthContext();

  const destination = parseExpenseMutationDestination(formData);
  const returnOrigin = destination === "workspace" ? parseExpenseSetupReturnOrigin(formData) : null;

  const businessId = parseResourceId(formData.get("business_id"));
  const expenseId = parseResourceId(formData.get("expense_id"));
  const name = normalizeExpenseName(formData.get("name"));
  const category = parseExpenseCategory(formData.get("category"));
  const costBehavior = parseExpenseCostBehavior(formData.get("cost_behavior"));
  const isActive = parseActiveState(formData.get("is_active"));

  if (!businessId) {
    redirect("/businesses");
  }

  const resultPath = (status: string) =>
    destination === "setup"
      ? setupExpensesPath(businessId, status)
      : expensesPath(businessId, status, returnOrigin);

  if (!destination || !expenseId || !name || !category || !costBehavior) {
    redirect(resultPath("invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: updatedExpense, error } = await supabase
    .from("expense_items")
    .update({
      name,
      category,
      cost_behavior: costBehavior,
      is_active: isActive,
    })
    .eq("id", expenseId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();

  if (error || !updatedExpense) {
    redirect(resultPath("update-failed"));
  }

  if (destination === "setup") {
    redirectAfterExpenseCreation(businessId, "updated", destination);
  }
  redirectToExpenses(businessId, "updated", returnOrigin);
}

export async function deleteExpenseItem(formData: FormData) {
  await requireAuthContext();

  const destination = parseExpenseMutationDestination(formData);
  const returnOrigin = destination === "workspace" ? parseExpenseSetupReturnOrigin(formData) : null;

  const businessId = parseResourceId(formData.get("business_id"));
  const expenseId = parseResourceId(formData.get("expense_id"));

  if (!businessId) {
    redirect("/businesses");
  }

  const resultPath = (status: string) =>
    destination === "setup"
      ? setupExpensesPath(businessId, status)
      : expensesPath(businessId, status, returnOrigin);

  if (!destination || !expenseId) {
    redirect(resultPath("invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: deletedExpense, error } = await supabase
    .from("expense_items")
    .delete()
    .eq("id", expenseId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();

  if (error?.code === "23503") {
    redirect(resultPath("in-use"));
  }

  if (error || !deletedExpense) {
    redirect(resultPath("delete-failed"));
  }

  if (destination === "setup") {
    redirectAfterExpenseCreation(businessId, "deleted", destination);
  }
  redirectToExpenses(businessId, "deleted", returnOrigin);
}
