"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import {
  EXPENSE_CATEGORIES,
  parseExpenseCategory,
  resolveExpenseSetupReview,
  type ExpenseCategory,
} from "@/lib/business/expenses";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { buildBusinessSetupHref } from "@/lib/business/setup-navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Builds the canonical Step 3 URL without accepting arbitrary return destinations. */
function setupExpensesPath(businessId: string, status: string) {
  return `${buildBusinessSetupHref(businessId, "expenses")}&status=${encodeURIComponent(status)}`;
}

/** Parses the explicit reviewed-none claims strictly and rejects duplicates or unknown categories. */
function parseExplicitNoneCategories(formData: FormData): ExpenseCategory[] | null {
  const values = formData.getAll("no_expense_category");
  if (values.length > EXPENSE_CATEGORIES.length) return null;

  const parsed: ExpenseCategory[] = [];
  const seen = new Set<ExpenseCategory>();
  for (const value of values) {
    if (typeof value !== "string") return null;
    const category = parseExpenseCategory(value);
    if (!category || seen.has(category)) return null;
    seen.add(category);
    parsed.push(category);
  }

  return parsed;
}

/**
 * Confirms Step 3 only after the server independently proves all four categories are resolved.
 *
 * The only persisted setup mutation is businesses.expense_setup_reviewed_at. Empty-category choices
 * are intentionally not stored separately; the final timestamp proves that every category was reviewed.
 */
export async function confirmExpenseSetupReview(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  if (!businessId) {
    redirect("/businesses");
  }

  const explicitNoneCategories = parseExplicitNoneCategories(formData);
  if (!explicitNoneCategories) {
    redirect(setupExpensesPath(businessId, "invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: activeExpenseRows, error: expenseError } = await supabase
    .from("expense_items")
    .select("category")
    .eq("business_id", businessId)
    .eq("is_active", true);

  if (expenseError) {
    redirect(setupExpensesPath(businessId, "review-failed"));
  }

  const activeCounts: Record<ExpenseCategory, number> = {
    acquisition: 0,
    fulfillment: 0,
    overhead: 0,
    financial: 0,
  };

  for (const row of activeExpenseRows ?? []) {
    const category = parseExpenseCategory(row.category);
    if (!category) {
      redirect(setupExpensesPath(businessId, "review-failed"));
    }
    activeCounts[category] += 1;
  }

  const resolution = resolveExpenseSetupReview(activeCounts, explicitNoneCategories);
  if (!resolution.resolved) {
    redirect(setupExpensesPath(businessId, "review-incomplete"));
  }

  const { data: updatedBusiness, error: updateError } = await supabase
    .from("businesses")
    .update({ expense_setup_reviewed_at: new Date().toISOString() })
    .eq("id", businessId)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedBusiness) {
    redirect(setupExpensesPath(businessId, "review-failed"));
  }

  revalidatePath("/businesses");
  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(`/businesses/${businessId}/expenses`);
  revalidatePath(buildBusinessSetupHref(businessId));
  redirect(setupExpensesPath(businessId, "reviewed"));
}
