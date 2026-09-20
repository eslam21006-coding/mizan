"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import {
  normalizeRevenueStreamName,
  parseActiveState,
  parseResourceId,
  parseRevenueStreamType,
} from "@/lib/business/revenue-streams";
import {
  parseSetupReturnOrigin,
  type SetupReturnOrigin,
} from "@/lib/setup-return-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parseRevenueSetupReturnOrigin(formData: FormData): SetupReturnOrigin | null {
  const origins = formData.getAll("origin");
  const months = formData.getAll("month");

  if (origins.length !== 1 || months.length !== 1) return null;

  const origin = origins[0];
  const month = months[0];
  if (typeof origin !== "string" || typeof month !== "string") return null;

  return parseSetupReturnOrigin({ origin, month });
}

function revenueStreamsPath(
  businessId: string,
  status: string,
  returnOrigin?: SetupReturnOrigin | null,
) {
  const query = new URLSearchParams({ status });
  if (returnOrigin) {
    query.set("origin", returnOrigin.origin);
    query.set("month", returnOrigin.month);
  }
  return `/businesses/${businessId}/revenue-streams?${query.toString()}`;
}

function redirectToRevenueStreams(
  businessId: string,
  status: string,
  returnOrigin?: SetupReturnOrigin | null,
): never {
  revalidatePath("/businesses");
  revalidatePath(`/businesses/${businessId}/revenue-streams`);
  revalidatePath(`/businesses/${businessId}/monthly`);
  redirect(revenueStreamsPath(businessId, status, returnOrigin));
}

export async function createRevenueStream(formData: FormData) {
  await requireAuthContext();

  const returnOrigin = parseRevenueSetupReturnOrigin(formData);

  const businessId = parseResourceId(formData.get("business_id"));
  const name = normalizeRevenueStreamName(formData.get("name"));
  const streamType = parseRevenueStreamType(formData.get("stream_type"));
  const creationRequestId = parseResourceId(formData.get("creation_request_id"));

  if (!businessId) {
    redirect("/businesses");
  }

  if (!name || !streamType || !creationRequestId) {
    redirect(revenueStreamsPath(businessId, "invalid", returnOrigin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("revenue_streams").insert({
    business_id: businessId,
    name,
    stream_type: streamType,
    creation_request_id: creationRequestId,
  });

  if (!error || error.code === "23505") {
    return redirectToRevenueStreams(businessId, "created", returnOrigin);
  }

  redirect(revenueStreamsPath(businessId, "create-failed", returnOrigin));
}

export async function updateRevenueStream(formData: FormData) {
  await requireAuthContext();

  const returnOrigin = parseRevenueSetupReturnOrigin(formData);

  const businessId = parseResourceId(formData.get("business_id"));
  const streamId = parseResourceId(formData.get("stream_id"));
  const name = normalizeRevenueStreamName(formData.get("name"));
  const streamType = parseRevenueStreamType(formData.get("stream_type"));
  const isActive = parseActiveState(formData.get("is_active"));

  if (!businessId) {
    redirect("/businesses");
  }

  if (!streamId || !name || !streamType) {
    redirect(revenueStreamsPath(businessId, "invalid", returnOrigin));
  }

  const supabase = await createSupabaseServerClient();
  const { data: updatedStream, error } = await supabase
    .from("revenue_streams")
    .update({
      name,
      stream_type: streamType,
      is_active: isActive,
    })
    .eq("id", streamId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();

  if (error || !updatedStream) {
    redirect(revenueStreamsPath(businessId, "update-failed", returnOrigin));
  }

  redirectToRevenueStreams(businessId, "updated", returnOrigin);
}

export async function deleteRevenueStream(formData: FormData) {
  await requireAuthContext();

  const returnOrigin = parseRevenueSetupReturnOrigin(formData);

  const businessId = parseResourceId(formData.get("business_id"));
  const streamId = parseResourceId(formData.get("stream_id"));

  if (!businessId) {
    redirect("/businesses");
  }

  if (!streamId) {
    redirect(revenueStreamsPath(businessId, "invalid", returnOrigin));
  }

  const supabase = await createSupabaseServerClient();
  const { data: deletedStream, error } = await supabase
    .from("revenue_streams")
    .delete()
    .eq("id", streamId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();

  if (error?.code === "23503") {
    redirect(revenueStreamsPath(businessId, "in-use", returnOrigin));
  }

  if (error || !deletedStream) {
    redirect(revenueStreamsPath(businessId, "delete-failed", returnOrigin));
  }

  redirectToRevenueStreams(businessId, "deleted", returnOrigin);
}
