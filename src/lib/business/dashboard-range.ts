import type { createSupabaseServerClient } from "../supabase/server";
import type { CoreCalculationResult } from "./calculations";
import { loadDashboardMonth } from "./dashboard-month";
import {
  aggregateHistoricalMonths,
  type HistoricalAggregateResult,
} from "./historical-aggregation";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const RANGE_LOAD_BATCH_SIZE = 6;

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

  const loaded: Array<{
    monthKey: string;
    load: Awaited<ReturnType<typeof loadDashboardMonth>>;
  }> = [];

  for (let start = 0; start < monthKeys.length; start += RANGE_LOAD_BATCH_SIZE) {
    const batch = monthKeys.slice(start, start + RANGE_LOAD_BATCH_SIZE);
    loaded.push(
      ...(await Promise.all(
        batch.map(async (monthKey) => ({
          monthKey,
          load: await loadDashboardMonth(supabase, businessId, `${monthKey}-01`),
        })),
      )),
    );
  }

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

  try {
    return {
      aggregate: aggregateHistoricalMonths(months.map(({ result }) => result)),
      months,
      missingMonthKeys: [],
      dataLoadError: false,
      calculationError: false,
    };
  } catch {
    return {
      aggregate: null,
      months,
      missingMonthKeys: [],
      dataLoadError: false,
      calculationError: true,
    };
  }
}
