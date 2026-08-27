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
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DECIMAL_PATTERN = /^\d{1,16}(?:\.\d{1,8})?$/;

function simulatorPath(
  businessId: string,
  month: string,
  status: string,
  scenarioId?: string | null,
) {
  const params = new URLSearchParams({ business: businessId, month, status });
  if (scenarioId) params.set("scenario", scenarioId);
  return `/simulator?${params.toString()}`;
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
): never {
  revalidatePath("/simulator");
  redirect(simulatorPath(businessId, month, status, scenarioId));
}

export async function saveSimulatorScenario(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const scenarioId = parseResourceId(formData.get("scenario_id"));
  const creationRequestId = parseResourceId(formData.get("creation_request_id"));
  const month = parseMonth(formData.get("month"));
  const name = parseScenarioName(formData.get("name"));
  const overrides = parseOverrides(formData.get("overrides_json"));

  if (!businessId) redirect("/simulator");
  if (!month || !name || !creationRequestId || !overrides) {
    redirectSimulator(businessId, month ?? "invalid", "invalid", scenarioId);
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
    redirectSimulator(businessId, month, "save-failed", scenarioId);
  }

  redirectSimulator(businessId, month, scenarioId ? "updated" : "saved", savedScenarioId);
}

export async function duplicateSimulatorScenario(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const scenarioId = parseResourceId(formData.get("scenario_id"));
  const creationRequestId = parseResourceId(formData.get("creation_request_id"));
  const month = parseMonth(formData.get("month"));
  const name = parseScenarioName(formData.get("name"));

  if (!businessId) redirect("/simulator");
  if (!month || !scenarioId || !creationRequestId || !name) {
    redirectSimulator(businessId, month ?? "invalid", "invalid", scenarioId);
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
    redirectSimulator(businessId, month, "duplicate-failed", scenarioId);
  }

  redirectSimulator(businessId, month, "duplicated", duplicatedScenarioId);
}

export async function deleteSimulatorScenario(formData: FormData) {
  await requireAuthContext();

  const businessId = parseResourceId(formData.get("business_id"));
  const scenarioId = parseResourceId(formData.get("scenario_id"));
  const month = parseMonth(formData.get("month"));

  if (!businessId) redirect("/simulator");
  if (!month || !scenarioId) {
    redirectSimulator(businessId, month ?? "invalid", "invalid", scenarioId);
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
    redirectSimulator(businessId, month, "delete-failed", scenarioId);
  }

  redirectSimulator(businessId, month, "deleted");
}
