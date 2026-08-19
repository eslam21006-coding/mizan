import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCoreFinancials,
  CalculationInputError,
  type CalculatedMetric,
  type ExactRatio,
} from "../../src/lib/business/calculations.ts";
import { buildDashboardCalculationInput } from "../../src/lib/business/dashboard.ts";

function availableValue<T>(metric: CalculatedMetric<T>) {
  assert.equal(metric.available, true);
  if (!metric.available) throw new Error(`Expected available metric, got ${metric.reason}`);
  return metric.value;
}

function ratio(numerator: string, denominator: string): ExactRatio {
  return { numerator, denominator };
}

test("dashboard adapter maps saved monthly snapshots into the locked calculation engine", () => {
  const input = buildDashboardCalculationInput({
    period: {
      new_customers: 10,
      total_paying_customers: 15,
      unallocated_gross_cash_collected: "0",
      unallocated_refunds: "0",
    },
    revenueEntries: [
      {
        revenue_stream_id: "front",
        stream_name_snapshot: "Front-End",
        stream_type_snapshot: "front_end",
        gross_cash_collected: "10000",
        refunds: "500",
      },
      {
        revenue_stream_id: "backend",
        stream_name_snapshot: "Backend",
        stream_type_snapshot: "backend",
        gross_cash_collected: "4000",
        refunds: "0",
      },
    ],
    expenseEntries: [
      {
        expense_item_id: "ads",
        expense_name_snapshot: "Ads",
        category_snapshot: "acquisition",
        cost_behavior_snapshot: "fixed_monthly",
        input_value: "2000",
        customer_count_basis: null,
      },
      {
        expense_item_id: "delivery",
        expense_name_snapshot: "Delivery",
        category_snapshot: "fulfillment",
        cost_behavior_snapshot: "per_customer",
        input_value: "20",
        customer_count_basis: "total_paying_customers",
      },
      {
        expense_item_id: "rent",
        expense_name_snapshot: "Rent",
        category_snapshot: "overhead",
        cost_behavior_snapshot: "fixed_monthly",
        input_value: "1000",
        customer_count_basis: null,
      },
      {
        expense_item_id: "processor",
        expense_name_snapshot: "Processor",
        category_snapshot: "financial",
        cost_behavior_snapshot: "percentage_revenue",
        input_value: "0.035",
        customer_count_basis: null,
      },
    ],
  });

  assert.equal(input.canonicalAdSpend, null);
  assert.equal(input.attributedRevenue, null);
  assert.equal(input.expenses[3]?.inputValue, "0.035");

  const result = calculateCoreFinancials(input);
  assert.equal(availableValue(result.netCashCollected), "13500");
  assert.equal(availableValue(result.returningCustomers), 5);
  assert.equal(availableValue(result.allBusinessCosts), "3772.5");
  assert.equal(availableValue(result.realNetProfit), "9727.5");
  assert.deepEqual(availableValue(result.realNetProfitMargin), ratio("1297", "1800"));
  assert.equal(availableValue(result.contributionProfit), "12727.5");
  assert.deepEqual(availableValue(result.contributionMargin), ratio("1697", "1800"));
  assert.deepEqual(availableValue(result.acquisitionCac), ratio("200", "1"));
  assert.deepEqual(availableValue(result.ultimateCac), ratio("1509", "4"));
  assert.deepEqual(availableValue(result.revenuePerPayingCustomer), ratio("900", "1"));
  assert.deepEqual(availableValue(result.revenuePerNewCustomer), ratio("1350", "1"));

  assert.deepEqual(result.mediaCac, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.mer, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.roas, { available: false, reason: "ATTRIBUTION_UNAVAILABLE" });
});

test("dashboard adapter preserves missing values instead of coercing them to zero", () => {
  const input = buildDashboardCalculationInput({
    period: {
      new_customers: null,
      total_paying_customers: 0,
      unallocated_gross_cash_collected: null,
      unallocated_refunds: "0",
    },
    revenueEntries: [
      {
        revenue_stream_id: "main",
        stream_name_snapshot: "Main",
        stream_type_snapshot: "other",
        gross_cash_collected: null,
        refunds: "0",
      },
    ],
    expenseEntries: [],
  });

  assert.equal(input.newCustomers, null);
  assert.equal(input.totalPayingCustomers, 0);
  assert.equal(input.unallocatedGrossCashCollected, null);
  assert.equal(input.revenueStreams[0]?.grossCashCollected, null);

  const result = calculateCoreFinancials(input);
  assert.deepEqual(result.netCashCollected, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.revenuePerPayingCustomer, {
    available: false,
    reason: "NO_PAYING_CUSTOMERS",
  });
});

test("corrupted historical expense snapshots fail closed in the canonical calculation engine", () => {
  assert.throws(
    () =>
      calculateCoreFinancials(
        buildDashboardCalculationInput({
          period: {
            new_customers: 1,
            total_paying_customers: 1,
            unallocated_gross_cash_collected: "0",
            unallocated_refunds: "0",
          },
          revenueEntries: [],
          expenseEntries: [
            {
              expense_item_id: "bad",
              expense_name_snapshot: "Bad snapshot",
              category_snapshot: "marketing",
              cost_behavior_snapshot: "fixed_monthly",
              input_value: "100",
            },
          ],
        }),
      ),
    CalculationInputError,
  );
});
