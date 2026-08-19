import {
  CALCULATION_EXPENSE_BEHAVIORS,
  CALCULATION_EXPENSE_CATEGORIES,
  CalculationInputError,
  type CalculationCustomerCountBasis,
  type CalculationExpenseBehavior,
  type CalculationExpenseCategory,
  type CoreCalculationInput,
} from "./calculations.ts";

type MonthlyPeriodSnapshot = {
  new_customers?: unknown;
  total_paying_customers?: unknown;
  unallocated_gross_cash_collected?: unknown;
  unallocated_refunds?: unknown;
};

type MonthlyRevenueSnapshot = {
  revenue_stream_id?: unknown;
  stream_name_snapshot?: unknown;
  stream_type_snapshot?: unknown;
  gross_cash_collected?: unknown;
  refunds?: unknown;
};

type MonthlyExpenseSnapshot = {
  expense_item_id?: unknown;
  expense_name_snapshot?: unknown;
  category_snapshot?: unknown;
  cost_behavior_snapshot?: unknown;
  input_value?: unknown;
  customer_count_basis?: unknown;
};

export type DashboardCalculationSource = {
  period: MonthlyPeriodSnapshot;
  revenueEntries: readonly MonthlyRevenueSnapshot[];
  expenseEntries: readonly MonthlyExpenseSnapshot[];
};

function nullableDecimalString(value: unknown) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function nullableCount(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function requiredSnapshotText(value: unknown, fieldName: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new CalculationInputError(`${fieldName} is required for dashboard calculations.`);
  return text;
}

function expenseCategory(value: unknown): CalculationExpenseCategory {
  const candidate = String(value ?? "") as CalculationExpenseCategory;
  if (!CALCULATION_EXPENSE_CATEGORIES.includes(candidate)) {
    throw new CalculationInputError(`Unsupported dashboard expense category: ${String(value ?? "")}`);
  }
  return candidate;
}

function expenseBehavior(value: unknown): CalculationExpenseBehavior {
  const candidate = String(value ?? "") as CalculationExpenseBehavior;
  if (!CALCULATION_EXPENSE_BEHAVIORS.includes(candidate)) {
    throw new CalculationInputError(`Unsupported dashboard expense behavior: ${String(value ?? "")}`);
  }
  return candidate;
}

function customerCountBasis(value: unknown): CalculationCustomerCountBasis | null {
  if (value === null || value === undefined || value === "") return null;
  const candidate = String(value);
  if (candidate === "new_customers" || candidate === "total_paying_customers") return candidate;
  throw new CalculationInputError(`Unsupported dashboard customer count basis: ${candidate}`);
}

export function buildDashboardCalculationInput({
  period,
  revenueEntries,
  expenseEntries,
}: DashboardCalculationSource): CoreCalculationInput {
  return {
    revenueStreams: revenueEntries.map((entry) => ({
      id: requiredSnapshotText(entry.revenue_stream_id, "revenue_stream_id"),
      name: requiredSnapshotText(entry.stream_name_snapshot, "stream_name_snapshot"),
      streamType: requiredSnapshotText(entry.stream_type_snapshot, "stream_type_snapshot"),
      grossCashCollected: nullableDecimalString(entry.gross_cash_collected),
      refunds: nullableDecimalString(entry.refunds),
    })),
    expenses: expenseEntries.map((entry) => ({
      id: requiredSnapshotText(entry.expense_item_id, "expense_item_id"),
      name: requiredSnapshotText(entry.expense_name_snapshot, "expense_name_snapshot"),
      category: expenseCategory(entry.category_snapshot),
      behavior: expenseBehavior(entry.cost_behavior_snapshot),
      inputValue: nullableDecimalString(entry.input_value),
      customerCountBasis: customerCountBasis(entry.customer_count_basis),
    })),
    unallocatedGrossCashCollected: nullableDecimalString(period.unallocated_gross_cash_collected),
    unallocatedRefunds: nullableDecimalString(period.unallocated_refunds),
    newCustomers: nullableCount(period.new_customers),
    totalPayingCustomers: nullableCount(period.total_paying_customers),
    // Task 8 does not persist a canonical business-level Ad Spend or attributed revenue field.
    // Task 11 must not infer either value from expense names or total business revenue.
    canonicalAdSpend: null,
    attributedRevenue: null,
  };
}
