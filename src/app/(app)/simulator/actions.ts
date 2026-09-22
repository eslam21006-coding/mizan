"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import {
  SCENARIO_OVERRIDE_KEYS,
  type ScenarioOverrideKey,
  type ScenarioOverrides,
} from "@/lib/business/scenario-engine";
import { parseResourceId } from "@/lib/business/revenue-streams";
import {
  buildSimulatorHref,
  parseSimulatorTargetPlannerReturnContext,
  SIMULATOR_TARGET_PLANNER_RETURN_KEYS,
  type SimulatorTargetPlannerReturnContext,
} from "@/lib/simulator-return-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DECIMAL_PATTERN = /^\d{1,16}(?:\.\d{1,8})?$/;

/** Reads validated Target Planner return metadata from a Simulator mutation form. */
function parseSimulatorReturnContext(formData: FormData) {
  const params = new URLSearchParams();
  for (const key of SIMULATOR_TARGET_PLANNER_RETURN_KEYS) {
    for (const value of formData.getAll(key)) {
      if (typeof value === "string") params.append(key, value);
    }
  }
  return parseSimulatorTargetPlannerReturnContext(params);
}

/** Builds the canonical Simulator redirect URL without accepting arbitrary return destinations. */
function simulatorPath(
  businessId: string,
  month: string,
  status: string,
  scenarioId?: string | null,
  returnContext?: SimulatorTargetPlannerReturnContext | null,
) {
  return buildSimulatorHref({
    businessId,
    month,
    status,
    scenarioId: scenarioId ?? undefined,
    returnContext,
  });
}

function parseMonth(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return value;
}

function parseScenarioName(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  if (value.length < 1 || value.length > 120 || value.trim() !== value) return null;
  if (!/\S/u.test(value)) return null;
  return value;
}

function isScenarioOverrideKey(value: string): value is ScenarioOverrideKey {
  return SCENARIO_OVERRIDE_KEYS.includes(value as ScenarioOverrideKey);
}

function parseOverrides(value: FormDataEntryValue | null): ScenarioOverrides | null {
  if (typeof value !== "string") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const overrides: ScenarioOverrides = {};
  for (const [key, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isScenarioOverrideKey(key) || typeof rawValue !== "string") return null;
    const normalized = rawValue.trim();
    if (!DECIMAL_PATTERN.test(normalized)) return null;
    if (
      (key === "show_rate" || key === "qualification_rate" || key === "close_rate") &&
      Number(normalized) > 1
    ) {
      return null;
    }
    overrides[key] = normalized;
  }
  return overrides;
}

function redirectSimulator(
  businessId: string,
  month: string,
  status: string,
  scenarioId?: string | null,
  returnContext?: SimulatorTargetPlannerReturnContext | null,
): never {
  revalidatePath("/simulator");
  redirect(simulatorPath(businessId, month, status, scenarioId, returnContext));
}

export async function saveSimulatorScenario(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const scenarioId = parseResourceId(formData.get("scenario_id"));
  const creationRequestId = parseResourceId(formData.get("creation_request_id"));
  const month = parseMonth(formData.get("month"));
  const returnContext = parseSimulatorReturnContext(formData);
  const name = parseScenarioName(formData.get("name"));
  const overrides = parseOverrides(formData.get("overrides_json"));

  if (!businessId) redirect("/simulator");
  if (!month || !name || !creationRequestId || !overrides) {
    redirectSimulator(businessId, month ?? "invalid", "invalid", scenarioId, returnContext);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_simulator_scenario", {
    p_business_id: businessId,
    p_scenario_id: scenarioId,
    p_name: name,
    p_creation_request_id: creationRequestId,
    p_overrides: overrides,
  });

  const savedScenarioId = typeof data === "string" ? data : null;
  if (error || !savedScenarioId) {
    redirectSimulator(businessId, month, "save-failed", scenarioId, returnContext);
  }

  redirectSimulator(businessId, month, scenarioId ? "updated" : "saved", savedScenarioId, returnContext);
}

export async function duplicateSimulatorScenario(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const scenarioId = parseResourceId(formData.get("scenario_id"));
  const creationRequestId = parseResourceId(formData.get("creation_request_id"));
  const month = parseMonth(formData.get("month"));
  const returnContext = parseSimulatorReturnContext(formData);
  const name = parseScenarioName(formData.get("name"));

  if (!businessId) redirect("/simulator");
  if (!month || !scenarioId || !creationRequestId || !name) {
    redirectSimulator(businessId, month ?? "invalid", "invalid", scenarioId, returnContext);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("duplicate_simulator_scenario", {
    p_business_id: businessId,
    p_source_scenario_id: scenarioId,
    p_name: name,
    p_creation_request_id: creationRequestId,
  });

  const duplicatedScenarioId = typeof data === "string" ? data : null;
  if (error || !duplicatedScenarioId) {
    redirectSimulator(businessId, month, "duplicate-failed", scenarioId, returnContext);
  }

  redirectSimulator(businessId, month, "duplicated", duplicatedScenarioId, returnContext);
}

export async function deleteSimulatorScenario(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const scenarioId = parseResourceId(formData.get("scenario_id"));
  const month = parseMonth(formData.get("month"));
  const returnContext = parseSimulatorReturnContext(formData);

  if (!businessId) redirect("/simulator");
  if (!month || !scenarioId) {
    redirectSimulator(businessId, month ?? "invalid", "invalid", scenarioId, returnContext);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("simulator_scenarios")
    .delete()
    .eq("business_id", businessId)
    .eq("id", scenarioId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirectSimulator(businessId, month, "delete-failed", scenarioId, returnContext);
  }

  redirectSimulator(businessId, month, "deleted", undefined, returnContext);
}
