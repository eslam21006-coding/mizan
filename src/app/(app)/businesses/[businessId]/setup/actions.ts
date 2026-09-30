"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import {
  EXPENSE_CATEGORIES,
  parseExpenseCategory,
  type ExpenseCategory,
} from "@/lib/business/expenses";
import { executeExpenseSetupReviewConfirmation } from "@/lib/business/expense-setup-review";
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
  const result = await executeExpenseSetupReviewConfirmation(explicitNoneCategories, {
    countActiveExpenses: async (category) => {
      const { count, error } = await supabase
        .from("expense_items")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("category", category)
        .eq("is_active", true);
      return { count, error };
    },
    persistReviewedAt: async (reviewedAt) => {
      const { data, error } = await supabase
        .from("businesses")
        .update({ expense_setup_reviewed_at: reviewedAt })
        .eq("id", businessId)
        .select("id")
        .maybeSingle();
      return { updated: Boolean(data), error };
    },
  });

  if (result.kind !== "reviewed") {
    redirect(setupExpensesPath(businessId, result.kind));
  }

  revalidatePath("/businesses");
  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(`/businesses/${businessId}/expenses`);
  revalidatePath(buildBusinessSetupHref(businessId));
  redirect(setupExpensesPath(businessId, "reviewed"));
}
