"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { isBusinessDeletionConfirmation } from "@/lib/business/business-deletion";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function deleteBusinessPath(businessId: string, status: string) {
  return `/settings/businesses/${businessId}/delete?status=${status}`;
}

export async function deleteBusiness(formData: FormData) {
  const auth = await requireAuthContext();
  const businessId = parseResourceId(formData.get("business_id"));

  if (!businessId) {
    redirect("/settings");
  }

  if (!isBusinessDeletionConfirmation(formData.get("confirmation"))) {
    redirect(deleteBusinessPath(businessId, "confirmation-required"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: business, error: lookupError } = await supabase
    .from("businesses")
    .select("id,owner_user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (lookupError || !business) {
    redirect(deleteBusinessPath(businessId, "failed"));
  }

  const canDelete = auth.role === "admin" || business.owner_user_id === auth.userId;
  if (!canDelete) {
    redirect("/access-denied");
  }

  const { data: deletedBusiness, error } = await supabase
    .from("businesses")
    .delete()
    .eq("id", businessId)
    .select("id")
    .maybeSingle();

  if (error?.code === "23503") {
    redirect(deleteBusinessPath(businessId, "protected-data"));
  }

  if (error || !deletedBusiness) {
    redirect(deleteBusinessPath(businessId, "failed"));
  }

  revalidatePath("/");
  revalidatePath("/businesses");
  revalidatePath("/monthly");
  revalidatePath("/settings");
  redirect("/settings?status=business-deleted");
}
