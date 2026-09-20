"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { parseReturnOrigin } from "@/lib/return-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildTransactionImportHref } from "@/lib/transaction-import-navigation";

/** Updates the business history-trust state through the database-authoritative owner/admin RPC. */
export async function setTransactionHistoryCompletenessAction(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(String(formData.get("business_id") ?? ""));
  const requestedState = String(formData.get("history_complete") ?? "");
  if (!businessId || (requestedState !== "true" && requestedState !== "false")) {
    redirect("/customers?status=invalid-history-state");
  }

  const originValue = formData.get("origin");
  const monthValue = formData.get("month");
  const returnOrigin = parseReturnOrigin({
    origin: typeof originValue === "string" && originValue ? originValue : undefined,
    month: typeof monthValue === "string" && monthValue ? monthValue : undefined,
  });
  const statusHref = (historyStatus: string) =>
    buildTransactionImportHref(businessId, returnOrigin, historyStatus);

  const historyComplete = requestedState === "true";
  if (historyComplete && formData.get("history_confirmation") !== "confirmed") {
    redirect(statusHref("confirmation-required"));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_transaction_history_complete", {
    p_business_id: businessId,
    p_complete: historyComplete,
  });

  if (error?.code === "MZ001") {
    redirect(statusHref("transactions-required"));
  }
  if (error?.code === "42501") redirect("/access-denied");
  if (error || data !== true) {
    redirect(statusHref("update-failed"));
  }

  revalidatePath(`/businesses/${businessId}/customers/import`);
  revalidatePath(`/businesses/${businessId}/monthly`);
  revalidatePath("/customers");
  revalidatePath("/");

  redirect(statusHref(historyComplete ? "complete" : "incomplete"));
}
