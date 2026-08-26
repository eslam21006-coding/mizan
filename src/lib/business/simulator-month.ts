import type { createSupabaseServerClient } from "../supabase/server";
import type { CoreCalculationResult } from "./calculations.ts";
import { loadDashboardMonth } from "./dashboard-month.ts";
import { loadFunnelMonth, type FunnelMonthlyEntrySnapshot } from "./funnel-month.ts";
import type {
  ScenarioEngineInput,
  ScenarioFinancialBaseline,
  ScenarioFunnelBaseline,
} from "./scenario-engine.ts";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type SimulatorMonthBlocker =
  | "MONTH_NOT_SAVED"
  | "MONTH_DATA_UNAVAILABLE"
  | "MONTH_CALCULATION_INVALID"
  | "NET_CASH_UNAVAILABLE"
  | "COSTS_UNAVAILABLE"
  | "VARIABLE_COSTS_UNAVAILABLE"
  | "NEW_CUSTOMERS_UNAVAILABLE"
  | "NO_NEW_CUSTOMERS"
  | "AD_SPEND_UNAVAILABLE";

export type SimulatorMonthLoadResult =
  | {
      status: "ready";
      input: Omit<ScenarioEngineInput, "overrides">;
      currentCore: CoreCalculationResult;
      funnelBaselineAvailable: boolean;
    }
  | { status: "insufficient"; blocker: SimulatorMonthBlocker };

function decimalString(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function safeAddCount(total: number, value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative safe integer.`);
  }
  if (total > Number.MAX_SAFE_INTEGER - value) {
    throw new Error(`${fieldName} exceeds the safe integer aggregation boundary.`);
  }
  return total + value;
}

function aggregateFunnelEntries(
  entries: readonly FunnelMonthlyEntrySnapshot[],
  expectedNewCustomers: number,
): ScenarioFunnelBaseline | null {
  if (entries.length === 0) return null;

  const fields = [
    "leads",
    "booked_calls",
    "showed_calls",
    "qualified_calls",
    "sales",
    "new_customers",
  ] as const;

  if (entries.some((entry) => fields.some((field) => entry[field] === null))) return null;

  const totals = entries.reduce(
    (aggregate, entry) => ({
      leads: safeAddCount(aggregate.leads, entry.leads as number, "leads"),
      bookedCalls: safeAddCount(
        aggregate.bookedCalls,
        entry.booked_calls as number,
        "bookedCalls",
      ),
      showedCalls: safeAddCount(
        aggregate.showedCalls,
        entry.showed_calls as number,
        "showedCalls",
      ),
      qualifiedCalls: safeAddCount(
        aggregate.qualifiedCalls,
        entry.qualified_calls as number,
        "qualifiedCalls",
      ),
      sales: safeAddCount(aggregate.sales, entry.sales as number, "sales"),
      newCustomers: safeAddCount(
        aggregate.newCustomers,
        entry.new_customers as number,
        "newCustomers",
      ),
    }),
    {
      leads: 0,
      bookedCalls: 0,
      showedCalls: 0,
      qualifiedCalls: 0,
      sales: 0,
      newCustomers: 0,
    },
  );

  if (totals.newCustomers !== expectedNewCustomers) return null;
  if (
    totals.leads === 0 ||
    totals.bookedCalls === 0 ||
    totals.showedCalls === 0 ||
    totals.qualifiedCalls === 0 ||
    totals.sales === 0 ||
    totals.newCustomers === 0
  ) {
    return null;
  }
  if (
    totals.bookedCalls > totals.leads ||
    totals.showedCalls > totals.bookedCalls ||
    totals.qualifiedCalls > totals.showedCalls ||
    totals.sales > totals.qualifiedCalls ||
    totals.newCustomers > totals.sales
  ) {
    return null;
  }

  return totals;
}

/**
 * Loads only historical actuals. Scenario data is applied later by the pure engine and never written here.
 */
export async function loadSimulatorMonth(
  supabase: ServerSupabaseClient,
  businessId: string,
  monthStart: string,
): Promise<SimulatorMonthLoadResult> {
  const [dashboardMonth, funnelMonth] = await Promise.all([
    loadDashboardMonth(supabase, businessId, monthStart),
    loadFunnelMonth(supabase, businessId, monthStart),
  ]);

  if (dashboardMonth.dataLoadError) {
    return { status: "insufficient", blocker: "MONTH_DATA_UNAVAILABLE" };
  }
  if (dashboardMonth.calculationError) {
    return { status: "insufficient", blocker: "MONTH_CALCULATION_INVALID" };
  }
  if (!dashboardMonth.periodExists || !dashboardMonth.result) {
    return { status: "insufficient", blocker: "MONTH_NOT_SAVED" };
  }

  const result = dashboardMonth.result;
  if (!result.netCashCollected.available) {
    return { status: "insufficient", blocker: "NET_CASH_UNAVAILABLE" };
  }
  if (!result.allBusinessCosts.available) {
    return { status: "insufficient", blocker: "COSTS_UNAVAILABLE" };
  }
  if (!result.variableCosts.available) {
    return { status: "insufficient", blocker: "VARIABLE_COSTS_UNAVAILABLE" };
  }
  if (!result.newCustomers.available) {
    return { status: "insufficient", blocker: "NEW_CUSTOMERS_UNAVAILABLE" };
  }
  if (result.newCustomers.value <= 0) {
    return { status: "insufficient", blocker: "NO_NEW_CUSTOMERS" };
  }
  if (
    funnelMonth.dataLoadError ||
    funnelMonth.reconciliationError ||
    !funnelMonth.reconciliation.canonicalAdSpend.available
  ) {
    return { status: "insufficient", blocker: "AD_SPEND_UNAVAILABLE" };
  }

  const adSpend = decimalString(funnelMonth.reconciliation.canonicalAdSpend.value);
  if (adSpend === null) {
    return { status: "insufficient", blocker: "AD_SPEND_UNAVAILABLE" };
  }

  const financial: ScenarioFinancialBaseline = {
    netCashCollected: result.netCashCollected.value,
    allBusinessCosts: result.allBusinessCosts.value,
    variableCosts: result.variableCosts.value,
    newCustomers: result.newCustomers.value,
    adSpend,
  };
  const funnel = aggregateFunnelEntries(funnelMonth.entries, result.newCustomers.value);

  return {
    status: "ready",
    input: { financial, funnel },
    currentCore: result,
    funnelBaselineAvailable: funnel !== null,
  };
}
