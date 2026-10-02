import type {
  ExpenseInputRow,
  MonthlyPeriodValues,
  RevenueInputRow,
} from "./monthly-entry-rows.ts";

export type MonthCompleteness = {
  complete: boolean;
  meaningful: boolean;
  missing: string[];
};

/**
 * A saved monthly period is not sufficient evidence that its financial inputs are complete.
 * This evaluator is deliberately independent of profitability: zero revenue/customers can
 * be fully confirmed while ratio-based metrics remain unavailable.
 *
 * The caller must use trusted, business-scoped required rows from the relevant month.
 * Never pass the submitted list of IDs as the authority for which rows were required.
 */
export function evaluateFirstMonthCompleteness(input: {
  hasSavedPeriod: boolean;
  revenueRows: readonly RevenueInputRow[];
  expenseRows: readonly ExpenseInputRow[];
  period: MonthlyPeriodValues;
}): MonthCompleteness {
  const missing: string[] = [];
  const period = input.period;
  const confirmed = (value: unknown) =>
    value !== null && value !== undefined && String(value).trim() !== "";

  if (!input.hasSavedPeriod) missing.push("unsaved_month");
  if (input.revenueRows.length === 0) missing.push("revenue_sources");
  for (const row of input.revenueRows) {
    if (!confirmed(row.gross)) missing.push(`gross:${row.id}`);
    if (!confirmed(row.refunds)) missing.push(`refunds:${row.id}`);
  }
  if (!confirmed(period?.new_customers)) missing.push("new_customers");
  if (!confirmed(period?.total_paying_customers)) missing.push("total_paying_customers");
  for (const row of input.expenseRows) {
    if (!confirmed(row.value)) missing.push(`expense:${row.id}`);
    if (row.behavior === "per_customer" && !confirmed(row.basis)) {
      missing.push(`basis:${row.id}`);
    }
  }

  const meaningful =
    input.revenueRows.some((row) => confirmed(row.gross) || confirmed(row.refunds)) ||
    input.expenseRows.some((row) => confirmed(row.value)) ||
    confirmed(period?.new_customers) ||
    confirmed(period?.total_paying_customers) ||
    confirmed(period?.unallocated_gross_cash_collected) ||
    confirmed(period?.unallocated_refunds);

  return { complete: missing.length === 0, meaningful, missing };
}
