import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCoreFinancials,
  type CalculatedMetric,
  type ExactRatio,
} from "../../src/lib/business/calculations.ts";
import { resolvePreviousComparisonMonth } from "../../src/lib/business/comparison-period.ts";
import {
  compareCountMetrics,
  compareDecimalMetrics,
  compareRatioMetrics,
} from "../../src/lib/business/comparison.ts";
import { buildDashboardCalculationInput } from "../../src/lib/business/dashboard.ts";
import {
  formatArabicExactDecimal,
  formatArabicExactPercent,
  formatArabicExactRatio,
} from "../../src/lib/business/format-exact.ts";

function available<T>(value: T): CalculatedMetric<T> {
  return { available: true, value };
}

function unavailable<T>(): CalculatedMetric<T> {
  return { available: false, reason: "INPUT_UNAVAILABLE" };
}

function ratio(numerator: string, denominator: string): ExactRatio {
  return { numerator, denominator };
}

function calculatedMonth({
  gross,
  refunds,
  newCustomers,
  payingCustomers,
  acquisition,
  fulfillmentPerPaying,
  overhead,
}: {
  gross: string;
  refunds: string;
  newCustomers: number;
  payingCustomers: number;
  acquisition: string;
  fulfillmentPerPaying: string;
  overhead: string;
}) {
  return calculateCoreFinancials(
    buildDashboardCalculationInput({
      period: {
        new_customers: newCustomers,
        total_paying_customers: payingCustomers,
        unallocated_gross_cash_collected: "0",
        unallocated_refunds: "0",
      },
      revenueEntries: [
        {
          revenue_stream_id: "main",
          stream_name_snapshot: "Main",
          stream_type_snapshot: "front_end",
          gross_cash_collected: gross,
          refunds,
        },
      ],
      expenseEntries: [
        {
          expense_item_id: "acq",
          expense_name_snapshot: "Acquisition",
          category_snapshot: "acquisition",
          cost_behavior_snapshot: "fixed_monthly",
          input_value: acquisition,
          customer_count_basis: null,
        },
        {
          expense_item_id: "fulfillment",
          expense_name_snapshot: "Fulfillment",
          category_snapshot: "fulfillment",
          cost_behavior_snapshot: "per_customer",
          input_value: fulfillmentPerPaying,
          customer_count_basis: "total_paying_customers",
        },
        {
          expense_item_id: "overhead",
          expense_name_snapshot: "Overhead",
          category_snapshot: "overhead",
          cost_behavior_snapshot: "fixed_monthly",
          input_value: overhead,
          customer_count_basis: null,
        },
      ],
    }),
  );
}

test("money comparison keeps exact signed change and relative change", () => {
  assert.deepEqual(compareDecimalMetrics(available("13500"), available("12000")), {
    available: true,
    direction: "up",
    change: ratio("1500", "1"),
    relativeChange: ratio("1", "8"),
  });

  assert.deepEqual(compareDecimalMetrics(available("9727.5"), available("10500")), {
    available: true,
    direction: "down",
    change: ratio("-1545", "2"),
    relativeChange: ratio("-103", "1400"),
  });
});

test("relative change uses previous magnitude when profit crosses zero", () => {
  assert.deepEqual(compareDecimalMetrics(available("5000"), available("-10000")), {
    available: true,
    direction: "up",
    change: ratio("15000", "1"),
    relativeChange: ratio("3", "2"),
  });
});

test("relative percentage is unavailable when previous value is exactly zero", () => {
  assert.deepEqual(compareCountMetrics(available(5), available(0)), {
    available: true,
    direction: "up",
    change: ratio("5", "1"),
    relativeChange: null,
  });
});

test("ratio comparison returns exact percentage-point delta input", () => {
  assert.deepEqual(compareRatioMetrics(available(ratio("3", "4")), available(ratio("7", "10"))), {
    available: true,
    direction: "up",
    change: ratio("1", "20"),
    relativeChange: ratio("1", "14"),
  });
});

test("comparison fails closed when either month is unavailable", () => {
  assert.deepEqual(compareDecimalMetrics(unavailable(), available("100")), {
    available: false,
    reason: "CURRENT_UNAVAILABLE",
  });
  assert.deepEqual(compareDecimalMetrics(available("100"), unavailable()), {
    available: false,
    reason: "PREVIOUS_UNAVAILABLE",
  });
});

test("flat comparison remains exact", () => {
  assert.deepEqual(compareDecimalMetrics(available("123.450"), available("123.45")), {
    available: true,
    direction: "flat",
    change: ratio("0", "1"),
    relativeChange: ratio("0", "1"),
  });
});

test("exact display formatting does not round through JavaScript Number", () => {
  assert.equal(
    formatArabicExactDecimal("9007199254740993"),
    "٩٬٠٠٧٬١٩٩٬٢٥٤٬٧٤٠٬٩٩٣",
  );
  assert.equal(
    formatArabicExactDecimal("9007199254740993.125", 2),
    "٩٬٠٠٧٬١٩٩٬٢٥٤٬٧٤٠٬٩٩٣٫١٣",
  );
  assert.equal(
    formatArabicExactRatio(ratio("9007199254740993", "1"), 2),
    "٩٬٠٠٧٬١٩٩٬٢٥٤٬٧٤٠٬٩٩٣",
  );
  assert.equal(formatArabicExactPercent(ratio("721", "1000"), 1), "٧٢٫١");
});

test("January 2000 resolves to an unsupported previous-month boundary instead of throwing", () => {
  assert.deepEqual(resolvePreviousComparisonMonth("2000-01"), {
    monthKey: "1999-12",
    parsed: null,
  });
  assert.deepEqual(resolvePreviousComparisonMonth("2000-02"), {
    monthKey: "2000-01",
    parsed: {
      monthKey: "2000-01",
      monthStart: "2000-01-01",
    },
  });
});

test("known monthly snapshots are recalculated independently before comparison", () => {
  const previous = calculatedMonth({
    gross: "10000",
    refunds: "1000",
    newCustomers: 10,
    payingCustomers: 12,
    acquisition: "2000",
    fulfillmentPerPaying: "100",
    overhead: "800",
  });
  const current = calculatedMonth({
    gross: "15000",
    refunds: "1000",
    newCustomers: 14,
    payingCustomers: 18,
    acquisition: "2800",
    fulfillmentPerPaying: "100",
    overhead: "900",
  });

  assert.deepEqual(compareDecimalMetrics(current.netCashCollected, previous.netCashCollected), {
    available: true,
    direction: "up",
    change: ratio("5000", "1"),
    relativeChange: ratio("5", "9"),
  });
  assert.deepEqual(compareDecimalMetrics(current.realNetProfit, previous.realNetProfit), {
    available: true,
    direction: "up",
    change: ratio("3500", "1"),
    relativeChange: ratio("7", "10"),
  });
  assert.deepEqual(compareRatioMetrics(current.ultimateCac, previous.ultimateCac), {
    available: true,
    direction: "down",
    change: ratio("-50", "7"),
    relativeChange: ratio("-1", "56"),
  });
  assert.deepEqual(compareCountMetrics(current.newCustomers, previous.newCustomers), {
    available: true,
    direction: "up",
    change: ratio("4", "1"),
    relativeChange: ratio("2", "5"),
  });
});
