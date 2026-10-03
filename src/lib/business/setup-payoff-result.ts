import type { CoreCalculationResult } from "./calculations.ts";
import type { BusinessSetupLoadResult, LoadedBusinessSetup } from "./setup-loader.ts";
import { currentMonthKeyForTimeZone, parseMonthKey } from "./monthly.ts";
import { resolveSavedSetupMonthEligibility } from "./setup-month-readiness.ts";
import type { DashboardMonthLoadResult } from "./dashboard-month.ts";

export type PayoffBlockReason =
  | "missing_month"
  | "invalid_month"
  | "future_month"
  | "not_saved"
  | "month_incomplete"
  | "setup_incomplete"
  | "data_load_error"
  | "calculation_error";

export type SetupPayoffResult =
  | { kind: "not_found" }
  | {
      kind: PayoffBlockReason;
      business: LoadedBusinessSetup["business"] | null;
      monthKey: string | null;
    }
  | {
      kind: "ready";
      business: LoadedBusinessSetup["business"];
      monthKey: string;
      financials: CoreCalculationResult;
    };

type PayoffDependencies = {
  loadSetup: (businessId: string) => Promise<BusinessSetupLoadResult>;
  loadMonth: (businessId: string, monthStart: string) => Promise<DashboardMonthLoadResult>;
};

/** Checks exact calendar identity and independent setup readiness without guessing a fallback month. */
export function resolvePayoffMonthGate(
  setup: LoadedBusinessSetup,
  requestedMonth: string | readonly string[] | undefined,
  now = new Date(),
): { kind: "ready"; monthKey: string } | {
  kind: Exclude<PayoffBlockReason, "data_load_error" | "calculation_error">;
  monthKey: string | null;
} {
  const eligible = resolveSavedSetupMonthEligibility(setup.persistedMonths, requestedMonth);
  if (eligible.kind !== "ready" && eligible.kind !== "not_saved" && eligible.kind !== "month_incomplete") {
    return { kind: eligible.kind, monthKey: null };
  }

  const monthKey = eligible.monthKey;
  const selected = parseMonthKey(monthKey);
  if (!selected) return { kind: "invalid_month", monthKey: null };
  if (monthKey > currentMonthKeyForTimeZone(setup.business.timezone, now)) {
    return { kind: "future_month", monthKey };
  }
  if (eligible.kind !== "ready") return eligible;
  if (setup.readiness.coreSetup.loadState !== "loaded" ||
      setup.readiness.coreSetup.status !== "ready") {
    return { kind: "setup_incomplete", monthKey };
  }
  return eligible;
}

/**
 * Read-only payoff loader. The server adapter supplies the existing authenticated/RLS loaders;
 * injected dependencies allow every fail-closed state to be tested without a production database.
 */
export async function resolveSetupPayoffResult(
  businessId: string,
  requestedMonth: string | readonly string[] | undefined,
  dependencies: PayoffDependencies,
  now = new Date(),
): Promise<SetupPayoffResult> {
  let setup: BusinessSetupLoadResult;
  try {
    setup = await dependencies.loadSetup(businessId);
  } catch {
    // Even the business identity may be unknown after a read failure; reveal nothing.
    return { kind: "data_load_error", business: null, monthKey: null };
  }
  if (setup.kind === "not_found") return { kind: "not_found" };
  if (setup.kind === "load_error") {
    return { kind: "data_load_error", business: setup.business, monthKey: null };
  }

  const gate = resolvePayoffMonthGate(setup, requestedMonth, now);
  if (gate.kind !== "ready") {
    return { kind: gate.kind, business: setup.business, monthKey: gate.monthKey };
  }

  let month: DashboardMonthLoadResult;
  try {
    month = await dependencies.loadMonth(businessId, `${gate.monthKey}-01`);
  } catch {
    return { kind: "data_load_error", business: setup.business, monthKey: gate.monthKey };
  }
  if (month.dataLoadError) {
    return { kind: "data_load_error", business: setup.business, monthKey: gate.monthKey };
  }
  // A period can disappear between independent reads; never display stale numbers.
  if (!month.periodExists) {
    return { kind: "not_saved", business: setup.business, monthKey: gate.monthKey };
  }
  const result = month.result;
  if (
    month.calculationError ||
    !result ||
    !result.netCashCollected.available ||
    !result.realNetProfit.available ||
    !result.allBusinessCosts.available ||
    (!result.realNetProfitMargin.available &&
      result.realNetProfitMargin.reason !== "NON_POSITIVE_NET_CASH") ||
    (!result.ultimateCac.available && result.ultimateCac.reason !== "NO_NEW_CUSTOMERS")
  ) {
    return { kind: "calculation_error", business: setup.business, monthKey: gate.monthKey };
  }
  return { kind: "ready", business: setup.business, monthKey: gate.monthKey, financials: result };
}
