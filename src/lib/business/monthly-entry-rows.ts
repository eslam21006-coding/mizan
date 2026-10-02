import { storedExpenseValueForDisplay } from "./monthly.ts";

export type RevenueInputRow = {
  id: string;
  name: string;
  streamType: string;
  active: boolean;
  gross: string;
  refunds: string;
};

export type ExpenseInputRow = {
  id: string;
  name: string;
  category: string;
  behavior: string;
  active: boolean;
  value: string;
  basis: string;
};

export type MonthlyPeriodValues = {
  new_customers?: unknown;
  total_paying_customers?: unknown;
  unallocated_gross_cash_collected?: unknown;
  unallocated_refunds?: unknown;
  adjustment_note?: unknown;
} | null;

type RevenueSource = {
  id: string;
  name: string;
  stream_type: string;
  is_active: boolean;
};

type ExpenseDefinition = {
  id: string;
  name: string;
  category: string;
  cost_behavior: string;
  is_active: boolean;
};

type MonthlyRowInput = {
  streams: readonly RevenueSource[];
  expenses: readonly ExpenseDefinition[];
  revenueEntries: readonly Record<string, unknown>[];
  expenseEntries: readonly Record<string, unknown>[];
};

/** Preserve blank/unknown values while rendering saved zeros as "0". */
export function monthlyInputValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Canonical Monthly row construction for both the existing editor and first-month setup.
 * Historical snapshot rows are kept even when their source/expense is now inactive.
 */
export function buildMonthlyEntryRows(input: MonthlyRowInput): {
  revenueRows: RevenueInputRow[];
  expenseRows: ExpenseInputRow[];
} {
  const revenueEntryById = new Map(
    input.revenueEntries.map((entry) => [String(entry.revenue_stream_id), entry]),
  );
  const expenseEntryById = new Map(
    input.expenseEntries.map((entry) => [String(entry.expense_item_id), entry]),
  );

  const revenueRows = input.streams
    .filter((stream) => stream.is_active || revenueEntryById.has(stream.id))
    .map((stream) => {
      const entry = revenueEntryById.get(stream.id);
      return {
        id: stream.id,
        name: String(entry?.stream_name_snapshot ?? stream.name),
        streamType: String(entry?.stream_type_snapshot ?? stream.stream_type),
        active: stream.is_active,
        gross: monthlyInputValue(entry?.gross_cash_collected),
        refunds: monthlyInputValue(entry?.refunds),
      };
    });

  const expenseRows = input.expenses
    .filter((expense) => expense.is_active || expenseEntryById.has(expense.id))
    .map((expense) => {
      const entry = expenseEntryById.get(expense.id);
      const behavior = String(entry?.cost_behavior_snapshot ?? expense.cost_behavior);
      return {
        id: expense.id,
        name: String(entry?.expense_name_snapshot ?? expense.name),
        category: String(entry?.category_snapshot ?? expense.category),
        behavior,
        active: expense.is_active,
        value: storedExpenseValueForDisplay(
          entry?.input_value as string | number | null | undefined,
          behavior,
        ),
        basis: String(entry?.customer_count_basis ?? ""),
      };
    });

  return { revenueRows, expenseRows };
}
