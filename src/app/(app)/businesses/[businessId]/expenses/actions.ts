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
import { createSupabaseServerClient } from "@/lib/supabase/server";

function expensesPath(businessId: string, status: string) {
  return `/businesses/${businessId}/expenses?status=${status}`;
}

function redirectToExpenses(businessId: string, status: string): never {
  revalidatePath("/businesses");
  revalidatePath(`/businesses/${businessId}/expenses`);
  redirect(expensesPath(businessId, status));
}

export async function createExpenseItem(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const name = normalizeExpenseName(formData.get("name"));
  const category = parseExpenseCategory(formData.get("category"));
  const costBehavior = parseExpenseCostBehavior(formData.get("cost_behavior"));
  const creationRequestId = parseResourceId(formData.get("creation_request_id"));

  if (!businessId) {
    redirect("/businesses");
  }

  if (!name || !category || !costBehavior || !creationRequestId) {
    redirect(expensesPath(businessId, "invalid"));
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
    return redirectToExpenses(businessId, "created");
  }

  redirect(expensesPath(businessId, "create-failed"));
}

export async function updateExpenseItem(formData: FormData) {
  await requireAuthContext();

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
    redirect(expensesPath(businessId, "invalid"));
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
    redirect(expensesPath(businessId, "update-failed"));
  }

  redirectToExpenses(businessId, "updated");
}
