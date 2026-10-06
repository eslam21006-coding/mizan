import type { PayoffBlockReason } from "./setup-payoff-result.ts";
import {
  buildBusinessSetupHref,
  type BusinessSetupStep,
} from "./setup-navigation.ts";

type PayoffGateKind = "ready" | Exclude<PayoffBlockReason, "calculation_error">;

export type SetupMonthPrimaryAction = {
  enabled: boolean;
  href: string | null;
  label: "إنهاء الإعداد" | "أكمل الإعداد";
};

/**
 * Resolves Step 4's primary action without inferring readiness from another month.
 * Exact-month payoff remains independently verified by the result route.
 */
export function resolveSetupMonthPrimaryAction(input: {
  businessId: string;
  monthKey: string | null;
  gateKind: PayoffGateKind | null;
  selectedMonthLoaded: boolean;
  selectedMonthComplete: boolean;
  resumeStep: BusinessSetupStep | null;
}): SetupMonthPrimaryAction {
  if (
    !input.monthKey ||
    !input.selectedMonthLoaded ||
    !input.selectedMonthComplete
  ) {
    return { enabled: false, href: null, label: "إنهاء الإعداد" };
  }

  if (input.gateKind === "ready") {
    return {
      enabled: true,
      href: `/businesses/${encodeURIComponent(input.businessId)}/setup/result?month=${encodeURIComponent(input.monthKey)}`,
      label: "إنهاء الإعداد",
    };
  }

  if (
    input.gateKind === "setup_incomplete" &&
    input.resumeStep &&
    input.resumeStep !== "month"
  ) {
    return {
      enabled: true,
      href: buildBusinessSetupHref(input.businessId, input.resumeStep, {
        monthKey: input.monthKey,
      }),
      label: "أكمل الإعداد",
    };
  }

  return { enabled: false, href: null, label: "إنهاء الإعداد" };
}
