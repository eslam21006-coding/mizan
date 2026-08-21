import type { createSupabaseServerClient } from "../supabase/server";
import {
  calculateFunnelMetrics,
  FunnelCalculationInputError,
  reconcileBusinessAdSpend,
  type AdSpendReconciliationResult,
  type FunnelCalculationResult,
} from "./funnel-calculations.ts";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type FunnelMonthlyEntrySnapshot = {
  funnel_id: string;
  funnel_name_snapshot: string;
  funnel_type_snapshot: string;
  ad_spend: string | number | null;
  leads: number | null;
  booked_calls: number | null;
  showed_calls: number | null;
  qualified_calls: number | null;
  sales: number | null;
  new_customers: number | null;
  cash_collected: string | number | null;
  attributed_revenue: string | number | null;
};

export type FunnelMonthlyPeriodSnapshot = {
  id: string;
  business_ad_spend: string | number | null;
};

export type LoadedFunnelMonth = {
  period: FunnelMonthlyPeriodSnapshot | null;
  entries: FunnelMonthlyEntrySnapshot[];
  reconciliation: AdSpendReconciliationResult;
  reconciliationError: boolean;
  calculatedEntries: Array<{
    entry: FunnelMonthlyEntrySnapshot;
    result: FunnelCalculationResult | null;
    calculationError: boolean;
  }>;
  dataLoadError: boolean;
};

function nullableDecimal(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

export function safeReconcileBusinessAdSpend(
  businessAdSpend: string | null,
  funnelAdSpends: readonly (string | null)[],
) {
  try {
    return {
      reconciliation: reconcileBusinessAdSpend(businessAdSpend, funnelAdSpends),
      reconciliationError: false,
    };
  } catch (error) {
    if (error instanceof FunnelCalculationInputError) {
      return {
        reconciliation: reconcileBusinessAdSpend(null, []),
        reconciliationError: true,
      };
    }
    throw error;
  }
}

export async function loadFunnelMonth(
  supabase: ServerSupabaseClient,
  businessId: string,
  monthStart: string,
): Promise<LoadedFunnelMonth> {
  const { data: period, error: periodError } = await supabase
    .from("funnel_monthly_periods")
    .select("id,business_ad_spend")
    .eq("business_id", businessId)
    .eq("month_start", monthStart)
    .maybeSingle();

  if (periodError) {
    return {
      period: null,
      entries: [],
      reconciliation: reconcileBusinessAdSpend(null, []),
      reconciliationError: false,
      calculatedEntries: [],
      dataLoadError: true,
    };
  }

  if (!period?.id) {
    return {
      period: null,
      entries: [],
      reconciliation: reconcileBusinessAdSpend(null, []),
      reconciliationError: false,
      calculatedEntries: [],
      dataLoadError: false,
    };
  }

  const { data: entriesData, error: entriesError } = await supabase
    .from("funnel_monthly_entries")
    .select(
      "funnel_id,funnel_name_snapshot,funnel_type_snapshot,ad_spend,leads,booked_calls,showed_calls,qualified_calls,sales,new_customers,cash_collected,attributed_revenue",
    )
    .eq("business_id", businessId)
    .eq("funnel_monthly_period_id", period.id)
    .order("created_at", { ascending: true });

  if (entriesError) {
    const safeReconciliation = safeReconcileBusinessAdSpend(
      nullableDecimal(period.business_ad_spend),
      [],
    );
    return {
      period: period as FunnelMonthlyPeriodSnapshot,
      entries: [],
      reconciliation: safeReconciliation.reconciliation,
      reconciliationError: safeReconciliation.reconciliationError,
      calculatedEntries: [],
      dataLoadError: true,
    };
  }

  const entries = (entriesData ?? []) as FunnelMonthlyEntrySnapshot[];
  const safeReconciliation = safeReconcileBusinessAdSpend(
    nullableDecimal(period.business_ad_spend),
    entries.map((entry) => nullableDecimal(entry.ad_spend)),
  );

  const calculatedEntries = entries.map((entry) => {
    try {
      return {
        entry,
        result: calculateFunnelMetrics({
          adSpend: nullableDecimal(entry.ad_spend),
          leads: entry.leads,
          bookedCalls: entry.booked_calls,
          showedCalls: entry.showed_calls,
          qualifiedCalls: entry.qualified_calls,
          sales: entry.sales,
          newCustomers: entry.new_customers,
          cashCollected: nullableDecimal(entry.cash_collected),
          attributedRevenue: nullableDecimal(entry.attributed_revenue),
        }),
        calculationError: false,
      };
    } catch (error) {
      if (error instanceof FunnelCalculationInputError) {
        return { entry, result: null, calculationError: true };
      }
      throw error;
    }
  });

  return {
    period: period as FunnelMonthlyPeriodSnapshot,
    entries,
    reconciliation: safeReconciliation.reconciliation,
    reconciliationError: safeReconciliation.reconciliationError,
    calculatedEntries,
    dataLoadError: false,
  };
}
