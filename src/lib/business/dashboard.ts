import type {
  CalculationCustomerCountBasis,
  CalculationExpenseBehavior,
  CalculationExpenseCategory,
  CoreCalculationInput,
} from "./calculations";

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

function snapshotText(value: unknown) {
  return String(value ?? "").trim();
}

function customerCountBasis(value: unknown): CalculationCustomerCountBasis | null {
  return value === null || value === undefined || value === ""
    ? null
    : (String(value) as CalculationCustomerCountBasis);
}

export function buildDashboardCalculationInput({
  period,
  revenueEntries,
  expenseEntries,
}: DashboardCalculationSource): CoreCalculationInput {
  return {
    revenueStreams: revenueEntries.map((entry) => ({
      id: snapshotText(entry.revenue_stream_id),
      name: snapshotText(entry.stream_name_snapshot),
      streamType: snapshotText(entry.stream_type_snapshot),
      grossCashCollected: nullableDecimalString(entry.gross_cash_collected),
      refunds: nullableDecimalString(entry.refunds),
    })),
    expenses: expenseEntries.map((entry) => ({
      id: snapshotText(entry.expense_item_id),
      name: snapshotText(entry.expense_name_snapshot),
      category: snapshotText(entry.category_snapshot) as CalculationExpenseCategory,
      behavior: snapshotText(entry.cost_behavior_snapshot) as CalculationExpenseBehavior,
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
