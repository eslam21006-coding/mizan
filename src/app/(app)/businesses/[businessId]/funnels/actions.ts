"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import {
  normalizeFunnelName,
  parseFunnelActiveState,
  parseFunnelResourceId,
  parseFunnelType,
} from "@/lib/business/funnels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function funnelsPath(businessId: string, status: string) {
  return `/businesses/${businessId}/funnels?status=${status}`;
}

function redirectToFunnels(businessId: string, status: string): never {
  revalidatePath("/businesses");
  revalidatePath(`/businesses/${businessId}/funnels`);
  redirect(funnelsPath(businessId, status));
}

export async function createFunnel(formData: FormData) {
  await requireAuthContext();

  const businessId = parseFunnelResourceId(formData.get("business_id"));
  const name = normalizeFunnelName(formData.get("name"));
  const funnelType = parseFunnelType(formData.get("funnel_type"));
  const creationRequestId = parseFunnelResourceId(formData.get("creation_request_id"));

  if (!businessId) {
    redirect("/businesses");
  }

  if (!name || !funnelType || !creationRequestId) {
    redirect(funnelsPath(businessId, "invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("funnels").insert({
    business_id: businessId,
    name,
    funnel_type: funnelType,
    creation_request_id: creationRequestId,
  });

  if (!error || error.code === "23505") {
    redirectToFunnels(businessId, "created");
  }

  redirect(funnelsPath(businessId, "create-failed"));
}

export async function updateFunnel(formData: FormData) {
  await requireAuthContext();

  const businessId = parseFunnelResourceId(formData.get("business_id"));
  const funnelId = parseFunnelResourceId(formData.get("funnel_id"));
  const name = normalizeFunnelName(formData.get("name"));
  const funnelType = parseFunnelType(formData.get("funnel_type"));
  const isActive = parseFunnelActiveState(formData.get("is_active"));

  if (!businessId) {
    redirect("/businesses");
  }

  if (!funnelId || !name || !funnelType) {
    redirect(funnelsPath(businessId, "invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: updatedFunnel, error } = await supabase
    .from("funnels")
    .update({
      name,
      funnel_type: funnelType,
      is_active: isActive,
    })
    .eq("id", funnelId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();

  if (error || !updatedFunnel) {
    redirect(funnelsPath(businessId, "update-failed"));
  }

  redirectToFunnels(businessId, "updated");
}
