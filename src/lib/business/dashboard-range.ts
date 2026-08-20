import type { CoreCalculationResult } from "./calculations";
import {
  aggregateHistoricalMonths,
  type HistoricalAggregateResult,
} from "./historical-aggregation";
import { loadDashboardMonth } from "./dashboard-month";
import type { createSupabaseServerClient } from "../supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type HistoricalMonthResult = {
  monthKey: string;
  result: CoreCalculationResult;
};

export type DashboardRangeLoadResult = {
  aggregate: HistoricalAggregateResult | null;
  months: HistoricalMonthResult[];
  missingMonthKeys: string[];
  dataLoadError: boolean;
  calculationError: boolean;
};

export async function loadDashboardRange(
  supabase: ServerSupabaseClient,
  businessId: string,
  monthKeys: readonly string[],
): Promise<DashboardRangeLoadResult> {
  if (monthKeys.length === 0) {
    return {
      aggregate: null,
      months: [],
      missingMonthKeys: [],
      dataLoadError: false,
      calculationError: false,
    };
  }

  const loaded = await Promise.all(
    monthKeys.map(async (monthKey) => ({
      monthKey,
      load: await loadDashboardMonth(supabase, businessId, `${monthKey}-01`),
    })),
  );

  const dataLoadError = loaded.some(({ load }) => load.dataLoadError);
  const calculationError = loaded.some(({ load }) => load.calculationError);
  const missingMonthKeys = loaded
    .filter(({ load }) => !load.periodExists)
    .map(({ monthKey }) => monthKey);
  const months = loaded.flatMap(({ monthKey, load }) =>
    load.result ? [{ monthKey, result: load.result }] : [],
  );

  if (dataLoadError || calculationError || missingMonthKeys.length > 0 || months.length !== monthKeys.length) {
    return {
      aggregate: null,
      months,
      missingMonthKeys,
      dataLoadError,
      calculationError,
    };
  }

  return {
    aggregate: aggregateHistoricalMonths(months.map(({ result }) => result)),
    months,
    missingMonthKeys: [],
    dataLoadError: false,
    calculationError: false,
  };
}
