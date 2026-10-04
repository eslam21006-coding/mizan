import { evaluateFirstMonthCompleteness } from "./first-month-completeness.ts";
import { parseMonthKey } from "./monthly.ts";
import { buildMonthlyEntryRows, type MonthlyPeriodValues } from "./monthly-entry-rows.ts";

type MonthPeriod = {
  id: string;
  month_start: string;
  created_at: string;
  new_customers: number | null;
  total_paying_customers: number | null;
  unallocated_gross_cash_collected?: string | number | null;
  unallocated_refunds?: string | number | null;
};
type Source = { id: string; name: string; stream_type: string; is_active: boolean; created_at: string };
type Expense = { id: string; name: string; category: string; cost_behavior: string; is_active: boolean; created_at: string };
type RevenueEntry = Record<string, unknown> & { monthly_period_id: string };
type ExpenseEntry = Record<string, unknown> & { monthly_period_id: string };

/**
 * Determines Setup completion from persisted financial records, never mere period existence.
 * Current active items created after the initial save are not retroactively required for that month;
 * archived items with saved historical snapshots remain in its required rows.
 */
export function assessSavedSetupMonths(input: {
  periods: readonly MonthPeriod[];
  streams: readonly Source[];
  expenses: readonly Expense[];
  revenueEntries: readonly RevenueEntry[];
  expenseEntries: readonly ExpenseEntry[];
}) {
  const revenueByMonth = new Map<string, RevenueEntry[]>();
  const expensesByMonth = new Map<string, ExpenseEntry[]>();
  for (const entry of input.revenueEntries) {
    const arr = revenueByMonth.get(entry.monthly_period_id) ?? [];
    arr.push(entry);
    revenueByMonth.set(entry.monthly_period_id, arr);
  }
  for (const entry of input.expenseEntries) {
    const arr = expensesByMonth.get(entry.monthly_period_id) ?? [];
    arr.push(entry);
    expensesByMonth.set(entry.monthly_period_id, arr);
  }

  const completedMonthKeys: string[] = [];
  for (const period of input.periods) {
    const savedRevenue = revenueByMonth.get(period.id) ?? [];
    const savedExpenses = expensesByMonth.get(period.id) ?? [];
    const sourceIds = new Set(savedRevenue.map((entry) => String(entry.revenue_stream_id)));
    const expenseIds = new Set(savedExpenses.map((entry) => String(entry.expense_item_id)));
    const { revenueRows, expenseRows } = buildMonthlyEntryRows({
      streams: input.streams.filter((s) => s.created_at <= period.created_at || sourceIds.has(s.id)),
      expenses: input.expenses.filter((e) => e.created_at <= period.created_at || expenseIds.has(e.id)),
      revenueEntries: savedRevenue,
      expenseEntries: savedExpenses,
    });
    const state = evaluateFirstMonthCompleteness({
      hasSavedPeriod: true,
      revenueRows,
      expenseRows,
      period: period as MonthlyPeriodValues,
    });
    if (state.complete) completedMonthKeys.push(period.month_start.slice(0, 7));
  }
  // Month identity is calendar-based, not insertion order or the most recent write.
  const savedMonthKeys = [...new Set(input.periods.map((period) => period.month_start.slice(0, 7)))]
    .sort()
    .reverse();
  const orderedCompleteMonths = [...new Set(completedMonthKeys)].sort().reverse();
  return {
    savedMonthKeys,
    completedMonthKeys: orderedCompleteMonths,
    validMonthCount: orderedCompleteMonths.length,
    latestSavedMonthKey: savedMonthKeys[0] ?? null,
    latestCompleteMonthKey: orderedCompleteMonths[0] ?? null,
  };
}

/** This assessment must come exclusively from fully loaded, persisted business-scoped rows. */
export type SavedSetupMonthAssessment = ReturnType<typeof assessSavedSetupMonths>;

export type SavedSetupMonthEligibility =
  | { kind: "ready"; monthKey: string }
  | { kind: "not_saved" | "month_incomplete"; monthKey: string }
  | { kind: "missing_month" | "invalid_month" | "load_error"; monthKey: null };

/**
 * Resolve an explicitly requested month without substituting another completed month.
 * A null assessment means an upstream read failed; absence of data is never readiness.
 * Global four-step setup readiness must be checked separately by the result route.
 */
export function resolveSavedSetupMonthEligibility(
  assessment: SavedSetupMonthAssessment | null,
  requestedMonth: string | readonly string[] | undefined,
): SavedSetupMonthEligibility {
  if (assessment === null) return { kind: "load_error", monthKey: null };
  if (requestedMonth === undefined) return { kind: "missing_month", monthKey: null };
  if (typeof requestedMonth !== "string") return { kind: "invalid_month", monthKey: null };
  const month = parseMonthKey(requestedMonth);
  if (!month) return { kind: "invalid_month", monthKey: null };
  if (!assessment.savedMonthKeys.includes(month.monthKey)) {
    return { kind: "not_saved", monthKey: month.monthKey };
  }
  if (!assessment.completedMonthKeys.includes(month.monthKey)) {
    return { kind: "month_incomplete", monthKey: month.monthKey };
  }
  return { kind: "ready", monthKey: month.monthKey };
}
