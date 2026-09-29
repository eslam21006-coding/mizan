"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import {
  normalizeBusinessName,
  normalizeTimeZone,
  parseBaseCurrency,
  parseCreationRequestId,
} from "@/lib/business/onboarding";
import { buildBusinessSetupHref } from "@/lib/business/setup-navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Revalidates business surfaces and hands a created identity to the canonical B04 setup route. */
function redirectToCreatedBusinessSetup(businessId: string): never {
  revalidatePath("/");
  revalidatePath("/businesses");
  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(buildBusinessSetupHref(businessId));
  redirect(buildBusinessSetupHref(businessId));
}

/** Validates and creates one authenticated user's business identity with idempotent retry recovery. */
export async function createBusiness(formData: FormData) {
  const auth = await requireAuthContext();
  const name = normalizeBusinessName(formData.get("name"));
  const baseCurrency = parseBaseCurrency(formData.get("base_currency"));
  const timezone = normalizeTimeZone(formData.get("timezone"));
  const creationRequestId = parseCreationRequestId(formData.get("creation_request_id"));

  if (!name || !baseCurrency || !timezone || !creationRequestId) {
    redirect("/businesses/new?status=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data: createdBusiness, error } = await supabase
    .from("businesses")
    .insert({
      name,
      base_currency: baseCurrency,
      timezone,
      owner_user_id: auth.userId,
      creation_request_id: creationRequestId,
    })
    .select("id")
    .single();

  if (!error && createdBusiness) {
    return redirectToCreatedBusinessSetup(createdBusiness.id);
  }

  if (error.code === "23505") {
    const { data: existingBusiness, error: lookupError } = await supabase
      .from("businesses")
      .select("id,name,base_currency,timezone")
      .eq("owner_user_id", auth.userId)
      .eq("creation_request_id", creationRequestId)
      .maybeSingle();

    const isSameRequestPayload =
      existingBusiness?.name === name &&
      existingBusiness.base_currency === baseCurrency &&
      existingBusiness.timezone === timezone;

    if (!lookupError && existingBusiness && isSameRequestPayload) {
      return redirectToCreatedBusinessSetup(existingBusiness.id);
    }
  }

  redirect("/businesses/new?status=create-failed");
}
