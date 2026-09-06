"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Updates the business history-trust state through the database-authoritative owner/admin RPC. */
export async function setTransactionHistoryCompletenessAction(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(String(formData.get("business_id") ?? ""));
  const requestedState = String(formData.get("history_complete") ?? "");
  if (!businessId || (requestedState !== "true" && requestedState !== "false")) {
    redirect("/customers?status=invalid-history-state");
  }

  const historyComplete = requestedState === "true";
  if (historyComplete && formData.get("history_confirmation") !== "confirmed") {
    redirect(`/businesses/${businessId}/customers/import?historyStatus=confirmation-required`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_transaction_history_complete", {
    p_business_id: businessId,
    p_complete: historyComplete,
  });

  if (error?.code === "MZ001") {
    redirect(`/businesses/${businessId}/customers/import?historyStatus=transactions-required`);
  }
  if (error?.code === "42501") redirect("/access-denied");
  if (error || data !== true) {
    redirect(`/businesses/${businessId}/customers/import?historyStatus=update-failed`);
  }

  revalidatePath(`/businesses/${businessId}/customers/import`);
  revalidatePath(`/businesses/${businessId}/monthly`);
  revalidatePath("/customers");
  revalidatePath("/");

  redirect(
    `/businesses/${businessId}/customers/import?historyStatus=${historyComplete ? "complete" : "incomplete"}`,
  );
}
