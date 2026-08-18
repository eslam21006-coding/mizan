"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import {
  normalizeBusinessName,
  normalizeTimeZone,
  parseBaseCurrency,
} from "@/lib/business/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createBusiness(formData: FormData) {
  const auth = await requireAuthContext();
  const name = normalizeBusinessName(formData.get("name"));
  const baseCurrency = parseBaseCurrency(formData.get("base_currency"));
  const timezone = normalizeTimeZone(formData.get("timezone"));

  if (!name || !baseCurrency || !timezone) {
    redirect("/businesses/new?status=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("businesses").insert({
    name,
    base_currency: baseCurrency,
    timezone,
    owner_user_id: auth.userId,
  });

  if (error) {
    redirect("/businesses/new?status=create-failed");
  }

  revalidatePath("/");
  revalidatePath("/businesses");
  redirect("/businesses?status=created");
}
