import type { SetupPayoffResult } from "./setup-payoff-result.ts";
import { buildBusinessSetupHref } from "./setup-navigation.ts";

export type FirstMonthPostSaveStatus =
  | "saved"
  | "setup-incomplete"
  | "result-unavailable"
  | "verification-unavailable";

/** Only the documented success statuses are displayed as saved-month feedback. */
export function parseFirstMonthPostSaveStatus(value: unknown): FirstMonthPostSaveStatus | null {
  switch (value) {
    case "saved":
    case "setup-incomplete":
    case "result-unavailable":
    case "verification-unavailable":
      return value;
    default:
      return null;
  }
}

/** No success handoff is inferred from the write response or from another completed month. */
export function resolveFirstMonthPostSaveDestination(
  businessId: string,
  savedMonthKey: string,
  verified: SetupPayoffResult,
): string {
  if (verified.kind === "not_found") return "/businesses";

  if (
    verified.kind === "ready" &&
    verified.business.id === businessId &&
    verified.monthKey === savedMonthKey
  ) {
    return `/businesses/${encodeURIComponent(businessId)}/setup/result?month=${encodeURIComponent(savedMonthKey)}`;
  }

  const status =
    verified.kind === "month_incomplete"
      ? "saved"
      : verified.kind === "setup_incomplete"
        ? "setup-incomplete"
        : verified.kind === "calculation_error"
          ? "result-unavailable"
          : "verification-unavailable";

  // A successful write remains saved even when subsequent verification fails.
  // Return to this exact month, never a silently selected previously completed month.
  return `${buildBusinessSetupHref(businessId, "month")}&month=${encodeURIComponent(savedMonthKey)}&status=${status}`;
}
