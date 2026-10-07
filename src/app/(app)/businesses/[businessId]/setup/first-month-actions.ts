"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { persistMonthlyActuals } from "@/lib/business/monthly-save-service";
import { parseMonthKey } from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { loadBusinessSetup } from "@/lib/business/setup-loader";
import { loadFirstMonthSetup } from "@/lib/business/first-month-setup";
import { loadAuthenticatedSetupPayoff } from "@/lib/business/setup-payoff-server";
import { resolveFirstMonthPostSaveDestination } from "@/lib/business/first-month-post-save";
import {
  resolveFirstMonthSaveRecovery,
  type FirstMonthSaveRecovery,
} from "@/lib/business/first-month-save-recovery";

export type FirstMonthSaveState = {
  attempt: number;
  status: "idle" | "error";
  code: string | null;
  fieldErrors: Record<string, string>;
  draft: Record<string, string>;
  recovery: FirstMonthSaveRecovery | null;
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

/** Reads exactly one submitted business/month identity without trusting duplicate hidden fields. */
function submittedSaveIdentity(formData: FormData) {
  const businessIds = formData.getAll("business_id");
  const months = formData.getAll("month");
  const businessId =
    businessIds.length === 1 ? parseResourceId(businessIds[0]) : null;
  const month = months.length === 1 ? parseMonthKey(months[0]) : null;
  return businessId && month
    ? { businessId, monthKey: month.monthKey }
    : null;
}

/**
 * An exception from the persistence call has an unknown write outcome. Re-read
 * the exact authorized business/month before describing the current database state.
 */
async function recoverUnknownSave(
  previous: FirstMonthSaveState,
  formData: FormData,
): Promise<FirstMonthSaveState> {
  const identity = submittedSaveIdentity(formData);
  let recovery: FirstMonthSaveRecovery = "unavailable";

  if (identity) {
    try {
      const setup = await loadBusinessSetup(identity.businessId);
      const month =
        setup.kind === "loaded"
          ? await loadFirstMonthSetup(
              identity.businessId,
              identity.monthKey,
              setup.business.timezone,
            )
          : null;
      recovery = resolveFirstMonthSaveRecovery(
        identity.businessId,
        identity.monthKey,
        setup,
        month,
      );
    } catch (error) {
      unstable_rethrow(error);
    }
  }

  return {
    attempt: previous.attempt + 1,
    status: "error",
    code: "save-uncertain",
    fieldErrors: {},
    draft: preserveDraft(formData),
    recovery,
  };
}

/** Setup's stateful adapter shares Monthly validation and atomic persistence. */
export async function saveFirstMonthSetup(
  previous: FirstMonthSaveState,
  formData: FormData,
): Promise<FirstMonthSaveState> {
  let result: Awaited<ReturnType<typeof persistMonthlyActuals>>;
  try {
    result = await persistMonthlyActuals(formData, { setupDraft: true });
  } catch (error) {
    unstable_rethrow(error);
    return recoverUnknownSave(previous, formData);
  }
  if (!result.ok) {
    return {
      attempt: previous.attempt + 1,
      status: "error",
      code: result.code,
      fieldErrors: result.fieldErrors,
      draft: preserveDraft(formData),
      recovery: null,
    };
  }

  const businessId = result.businessId;
  revalidatePath("/businesses");
  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(`/businesses/${businessId}/monthly`);
  revalidatePath(`/businesses/${businessId}/setup`);
  revalidatePath(`/businesses/${businessId}/setup/result`);
  revalidatePath("/insights");
  revalidatePath("/target-plan");

  // Only a successful atomic write reaches this read. Reload exact persisted numbers and
  // four-step readiness under the same authenticated RLS rules as the result route.
  let verified: Awaited<ReturnType<typeof loadAuthenticatedSetupPayoff>>;
  try {
    verified = await loadAuthenticatedSetupPayoff(businessId, result.monthKey);
  } catch (error) {
    // The write has already succeeded. Preserve its exact month if verification fails,
    // but never swallow Next.js redirects or other framework navigation signals.
    unstable_rethrow(error);
    redirect(resolveFirstMonthPostSaveDestination(businessId, result.monthKey, {
      kind: "data_load_error",
      business: null,
      monthKey: null,
    }));
  }
  redirect(resolveFirstMonthPostSaveDestination(businessId, result.monthKey, verified));
}
