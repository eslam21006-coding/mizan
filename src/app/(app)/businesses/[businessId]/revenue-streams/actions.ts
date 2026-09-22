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

/** Parses and validates the structured Monthly/setup return origin carried by revenue mutations. */
function parseRevenueSetupReturnOrigin(formData: FormData): SetupReturnOrigin | null {
  const origins = formData.getAll("origin");
  const months = formData.getAll("month");
  const upstreamOrigins = formData.getAll("upstream_origin");
  const upstreamMonths = formData.getAll("upstream_month");
  const upstreamInsightRules = formData.getAll("upstream_insight_rule");
  const upstreamInsightSubjects = formData.getAll("upstream_insight_subject");
  const upstreamPlannerSteps = formData.getAll("upstream_planner_step");
  const upstreamPlannerGoals = formData.getAll("upstream_planner_goal");
  const upstreamPlannerValues = formData.getAll("upstream_planner_value");

  if (
    origins.length !== 1 ||
    months.length !== 1 ||
    upstreamOrigins.length > 1 ||
    upstreamMonths.length > 1 ||
    upstreamInsightRules.length > 1 ||
    upstreamInsightSubjects.length > 1 ||
    upstreamPlannerSteps.length > 1 ||
    upstreamPlannerGoals.length > 1 ||
    upstreamPlannerValues.length > 1
  ) {
    return null;
  }

  const origin = origins[0];
  const month = months[0];
  const upstreamOrigin = upstreamOrigins[0];
  const upstreamMonth = upstreamMonths[0];
  const upstreamInsightRule = upstreamInsightRules[0];
  const upstreamInsightSubject = upstreamInsightSubjects[0];
  const upstreamPlannerStep = upstreamPlannerSteps[0];
  const upstreamPlannerGoal = upstreamPlannerGoals[0];
  const upstreamPlannerValue = upstreamPlannerValues[0];
  if (
    typeof origin !== "string" ||
    typeof month !== "string" ||
    (upstreamOrigin !== undefined && typeof upstreamOrigin !== "string") ||
    (upstreamMonth !== undefined && typeof upstreamMonth !== "string") ||
    (upstreamInsightRule !== undefined && typeof upstreamInsightRule !== "string") ||
    (upstreamInsightSubject !== undefined && typeof upstreamInsightSubject !== "string") ||
    (upstreamPlannerStep !== undefined && typeof upstreamPlannerStep !== "string") ||
    (upstreamPlannerGoal !== undefined && typeof upstreamPlannerGoal !== "string") ||
    (upstreamPlannerValue !== undefined && typeof upstreamPlannerValue !== "string")
  ) {
    return null;
  }

  return parseSetupReturnOrigin({
    origin,
    month,
    upstream_origin: upstreamOrigin,
    upstream_month: upstreamMonth,
    upstream_insight_rule: upstreamInsightRule,
    upstream_insight_subject: upstreamInsightSubject,
    upstream_planner_step: upstreamPlannerStep,
    upstream_planner_goal: upstreamPlannerGoal,
    upstream_planner_value: upstreamPlannerValue,
  });
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
    if (returnOrigin.upstream) {
      query.set("upstream_origin", returnOrigin.upstream.origin);
      if (
        (returnOrigin.upstream.origin === "customer-profitability" ||
          returnOrigin.upstream.origin === "insights") &&
        returnOrigin.upstream.month
      ) {
        query.set("upstream_month", returnOrigin.upstream.month);
      }
      if (returnOrigin.upstream.origin === "insights") {
        query.set("upstream_insight_rule", returnOrigin.upstream.ruleId);
        if (returnOrigin.upstream.subjectId) {
          query.set("upstream_insight_subject", returnOrigin.upstream.subjectId);
        }
      }
      if (returnOrigin.upstream.origin === "target-planner") {
        query.set("upstream_planner_step", returnOrigin.upstream.step);
        query.set("upstream_planner_goal", returnOrigin.upstream.goal);
        if (returnOrigin.upstream.value !== undefined) {
          query.set("upstream_planner_value", returnOrigin.upstream.value);
        }
      }
    }
  }
  return `/businesses/${businessId}/revenue-streams?${query.toString()}`;
}

/** Revalidates every surface affected by a revenue-stream mutation before returning to setup. */
function redirectToRevenueStreams(
  businessId: string,
  status: string,
  returnOrigin?: SetupReturnOrigin | null,
): never {
  revalidatePath("/businesses");
  revalidatePath("/insights");
  revalidatePath("/target-plan");
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
