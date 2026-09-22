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
import {
  parseSetupReturnOrigin,
  type SetupReturnOrigin,
} from "@/lib/setup-return-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parseExpenseSetupReturnOrigin(formData: FormData): SetupReturnOrigin | null {
  const origins = formData.getAll("origin");
  const months = formData.getAll("month");
  const upstreamOrigins = formData.getAll("upstream_origin");
  const upstreamMonths = formData.getAll("upstream_month");
  const upstreamInsightRules = formData.getAll("upstream_insight_rule");
  const upstreamInsightSubjects = formData.getAll("upstream_insight_subject");

  if (
    origins.length !== 1 ||
    months.length !== 1 ||
    upstreamOrigins.length > 1 ||
    upstreamMonths.length > 1 ||
    upstreamInsightRules.length > 1 ||
    upstreamInsightSubjects.length > 1
  ) {
    return null;
  }

  const origin = origins[0];
  const month = months[0];
  const upstreamOrigin = upstreamOrigins[0];
  const upstreamMonth = upstreamMonths[0];
  const upstreamInsightRule = upstreamInsightRules[0];
  const upstreamInsightSubject = upstreamInsightSubjects[0];
  if (
    typeof origin !== "string" ||
    typeof month !== "string" ||
    (upstreamOrigin !== undefined && typeof upstreamOrigin !== "string") ||
    (upstreamMonth !== undefined && typeof upstreamMonth !== "string") ||
    (upstreamInsightRule !== undefined && typeof upstreamInsightRule !== "string") ||
    (upstreamInsightSubject !== undefined && typeof upstreamInsightSubject !== "string")
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
        returnOrigin.upstream.origin === "customer-profitability" ||
        returnOrigin.upstream.origin === "insights"
      ) {
        query.set("upstream_month", returnOrigin.upstream.month);
      }
      if (returnOrigin.upstream.origin === "insights") {
        query.set("upstream_insight_rule", returnOrigin.upstream.ruleId);
        if (returnOrigin.upstream.subjectId) {
          query.set("upstream_insight_subject", returnOrigin.upstream.subjectId);
        }
      }
    }
  }
  return `/businesses/${businessId}/expenses?${query.toString()}`;
}

function redirectToExpenses(
  businessId: string,
  status: string,
  returnOrigin?: SetupReturnOrigin | null,
): never {
  revalidatePath("/businesses");
  revalidatePath("/insights");
  revalidatePath(`/businesses/${businessId}/expenses`);
  revalidatePath(`/businesses/${businessId}/monthly`);
  redirect(expensesPath(businessId, status, returnOrigin));
}

export async function createExpenseItem(formData: FormData) {
  await requireAuthContext();

  const returnOrigin = parseExpenseSetupReturnOrigin(formData);

  const businessId = parseResourceId(formData.get("business_id"));
  const name = normalizeExpenseName(formData.get("name"));
  const category = parseExpenseCategory(formData.get("category"));
  const costBehavior = parseExpenseCostBehavior(formData.get("cost_behavior"));
  const creationRequestId = parseResourceId(formData.get("creation_request_id"));

  if (!businessId) {
    redirect("/businesses");
  }

  if (!name || !category || !costBehavior || !creationRequestId) {
    redirect(expensesPath(businessId, "invalid", returnOrigin));
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
    return redirectToExpenses(businessId, "created", returnOrigin);
  }

  redirect(expensesPath(businessId, "create-failed", returnOrigin));
}

export async function updateExpenseItem(formData: FormData) {
  await requireAuthContext();

  const returnOrigin = parseExpenseSetupReturnOrigin(formData);

  const businessId = parseResourceId(formData.get("business_id"));
  const expenseId = parseResourceId(formData.get("expense_id"));
  const name = normalizeExpenseName(formData.get("name"));
  const category = parseExpenseCategory(formData.get("category"));
  const costBehavior = parseExpenseCostBehavior(formData.get("cost_behavior"));
  const isActive = parseActiveState(formData.get("is_active"));

  if (!businessId) {
    redirect("/businesses");
  }

  if (!expenseId || !name || !category || !costBehavior) {
    redirect(expensesPath(businessId, "invalid", returnOrigin));
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
    redirect(expensesPath(businessId, "update-failed", returnOrigin));
  }

  redirectToExpenses(businessId, "updated", returnOrigin);
}

export async function deleteExpenseItem(formData: FormData) {
  await requireAuthContext();

  const returnOrigin = parseExpenseSetupReturnOrigin(formData);

  const businessId = parseResourceId(formData.get("business_id"));
  const expenseId = parseResourceId(formData.get("expense_id"));

  if (!businessId) {
    redirect("/businesses");
  }

  if (!expenseId) {
    redirect(expensesPath(businessId, "invalid", returnOrigin));
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
    redirect(expensesPath(businessId, "in-use", returnOrigin));
  }

  if (error || !deletedExpense) {
    redirect(expensesPath(businessId, "delete-failed", returnOrigin));
  }

  redirectToExpenses(businessId, "deleted", returnOrigin);
}
