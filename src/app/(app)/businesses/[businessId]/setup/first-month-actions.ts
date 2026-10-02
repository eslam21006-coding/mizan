"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { persistMonthlyActuals } from "@/lib/business/monthly-save-service";
import { buildBusinessSetupHref } from "@/lib/business/setup-navigation";

export type FirstMonthSaveState = {
  attempt: number;
  status: "idle" | "error";
  code: string | null;
  fieldErrors: Record<string, string>;
  draft: Record<string, string>;
};

/** Only retain primitive, business-form fields; never put unsaved financial data in a URL. */
function preserveDraft(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  const known = new Set([
    "new_customers",
    "total_paying_customers",
    "unallocated_gross",
    "unallocated_refunds",
    "adjustment_note",
  ]);
  for (const [key, value] of formData.entries()) {
    if (
      typeof value !== "string" ||
      !(known.has(key) || /^(gross_|refund_|expense_value_|expense_basis_)[a-f\d-]{36}$/.test(key))
    ) continue;
    result[key] = value.slice(0, key === "adjustment_note" ? 501 : 100);
  }
  return result;
}

/** Setup's stateful adapter shares Monthly validation and atomic persistence. */
export async function saveFirstMonthSetup(
  previous: FirstMonthSaveState,
  formData: FormData,
): Promise<FirstMonthSaveState> {
  const result = await persistMonthlyActuals(formData, { setupDraft: true });
  if (!result.ok) {
    return {
      attempt: previous.attempt + 1,
      status: "error",
      code: result.code,
      fieldErrors: result.fieldErrors,
      draft: preserveDraft(formData),
    };
  }

  const businessId = result.businessId;
  revalidatePath("/businesses");
  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(`/businesses/${businessId}/monthly`);
  revalidatePath(`/businesses/${businessId}/setup`);
  revalidatePath("/insights");
  revalidatePath("/target-plan");
  redirect(`${buildBusinessSetupHref(businessId, "month")}&month=${result.monthKey}&status=saved`);
}
