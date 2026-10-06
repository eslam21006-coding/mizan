import { parseMonthKey } from "./monthly.ts";
import type {
  CoreSetupReadiness,
  CoreSetupRequirement,
} from "./readiness.ts";

export const BUSINESS_SETUP_STEPS = ["business", "revenue", "expenses", "month"] as const;
export type BusinessSetupStep = (typeof BUSINESS_SETUP_STEPS)[number];

export type ParsedBusinessSetupStep =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "valid"; step: BusinessSetupStep };

export type BusinessSetupHrefOptions = {
  monthKey?: string | null;
};

const REQUIREMENT_TO_STEP: Readonly<Record<CoreSetupRequirement, BusinessSetupStep>> = {
  business_identity: "business",
  revenue_setup: "revenue",
  expense_setup_review: "expenses",
  first_valid_month: "month",
};

/** Strictly parses one URL-addressable setup step and rejects duplicates or unsupported values. */
export function parseBusinessSetupStep(
  value: string | string[] | undefined,
): ParsedBusinessSetupStep {
  if (value === undefined) return { kind: "missing" };
  if (Array.isArray(value)) return { kind: "invalid" };
  if ((BUSINESS_SETUP_STEPS as readonly string[]).includes(value)) {
    return { kind: "valid", step: value as BusinessSetupStep };
  }
  return { kind: "invalid" };
}

/** Returns one canonical month context only when the URL supplied exactly one valid month. */
export function parseBusinessSetupMonthContext(
  value: string | string[] | undefined,
): string | null {
  if (value === undefined || Array.isArray(value)) return null;
  return parseMonthKey(value)?.monthKey ?? null;
}

/** Builds one canonical business-scoped setup URL and carries only validated month context. */
export function buildBusinessSetupHref(
  businessId: string,
  step?: BusinessSetupStep,
  options: BusinessSetupHrefOptions = {},
): string {
  const base = `/businesses/${encodeURIComponent(businessId)}/setup`;
  const params = new URLSearchParams();
  if (step) params.set("step", step);
  const monthKey = options.monthKey ? parseMonthKey(options.monthKey)?.monthKey : null;
  if (monthKey) params.set("month", monthKey);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** Maps one Core Setup requirement to its wizard step. */
export function businessSetupStepForRequirement(
  requirement: CoreSetupRequirement,
): BusinessSetupStep {
  return REQUIREMENT_TO_STEP[requirement];
}

/** Returns the first incomplete canonical Core Setup step, or null when setup is complete. */
export function resolveBusinessSetupResumeStep(
  coreSetup: CoreSetupReadiness,
): BusinessSetupStep | null {
  if (coreSetup.loadState === "load_error") return null;
  const requirement = coreSetup.missing[0];
  return requirement ? businessSetupStepForRequirement(requirement) : null;
}

/** Returns the deterministic previous wizard step, if one exists. */
export function previousBusinessSetupStep(
  step: BusinessSetupStep,
): BusinessSetupStep | null {
  const index = BUSINESS_SETUP_STEPS.indexOf(step);
  return index > 0 ? BUSINESS_SETUP_STEPS[index - 1] : null;
}

/** Returns the deterministic next wizard step, if one exists. */
export function nextBusinessSetupStep(
  step: BusinessSetupStep,
): BusinessSetupStep | null {
  const index = BUSINESS_SETUP_STEPS.indexOf(step);
  return index >= 0 && index < BUSINESS_SETUP_STEPS.length - 1
    ? BUSINESS_SETUP_STEPS[index + 1]
    : null;
}
