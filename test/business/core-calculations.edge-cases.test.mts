import assert from "node:assert/strict";
import test from "node:test";
import {
  CalculationInputError,
  calculateCoreFinancials,
  type CalculatedMetric,
  type CoreCalculationInput,
  type ExactRatio,
  type MonthlyExpenseCalculationInput,
} from "../../src/lib/business/calculations.ts";

function availableValue<T>(metric: CalculatedMetric<T>) {
  assert.equal(metric.available, true);
  if (!metric.available) throw new Error(`Expected available metric, got ${metric.reason}`);
  return metric.value;
}

function ratio(numerator: string, denominator: string): ExactRatio {
  return { numerator, denominator };
}

function input(overrides: Partial<CoreCalculationInput> = {}): CoreCalculationInput {
  return {
    revenueStreams: [
      {
        id: "main",
        name: "Main",
        streamType: "other",
        grossCashCollected: "1000",
        refunds: "0",
      },
    ],
    expenses: [],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers: 10,
    totalPayingCustomers: 20,
    ...overrides,
  };
}

test("exact decimal arithmetic never introduces binary floating-point drift", () => {
  const result = calculateCoreFinancials(
    input({
      revenueStreams: [
        {
          id: "a",
          name: "A",
          streamType: "front_end",
          grossCashCollected: "0.1",
          refunds: "0.03",
        },
        {
          id: "b",
          name: "B",
          streamType: "backend",
          grossCashCollected: "0.2",
          refunds: "0.07",
        },
      ],
      unallocatedGrossCashCollected: "0.005",
      unallocatedRefunds: "0",
      newCustomers: 1,
      totalPayingCustomers: 1,
      expenses: [
        {
          id: "fee",
          name: "Fee",
          category: "financial",
          behavior: "percentage_revenue",
          inputValue: "0.1",
        },
      ],
    }),
  );

  assert.equal(availableValue(result.grossCashCollected), "0.305");
  assert.equal(availableValue(result.refunds), "0.1");
  assert.equal(availableValue(result.netCashCollected), "0.205");
  assert.equal(availableValue(result.expensesByCategory.financial), "0.0205");
  assert.equal(availableValue(result.realNetProfit), "0.1845");
  assert.deepEqual(availableValue(result.realNetProfitMargin), ratio("9", "10"));
});

test("12-decimal percentage rates remain exact beyond normal currency display precision", () => {
  const result = calculateCoreFinancials(
    input({
      revenueStreams: [
        {
          id: "tiny",
          name: "Tiny",
          streamType: "other",
          grossCashCollected: "0.1",
          refunds: "0",
        },
      ],
      newCustomers: 1,
      totalPayingCustomers: 1,
      expenses: [
        {
          id: "tiny-rate",
          name: "Tiny Rate",
          category: "financial",
          behavior: "percentage_revenue",
          inputValue: "0.000000000001",
        },
      ],
    }),
  );

  assert.equal(availableValue(result.expensesByCategory.financial), "0.0000000000001");
  assert.equal(availableValue(result.realNetProfit), "0.0999999999999");
});

test("per-customer expenses honor new-customer and total-paying bases independently", () => {
  const result = calculateCoreFinancials(
    input({
      newCustomers: 3,
      totalPayingCustomers: 8,
      expenses: [
        {
          id: "new-basis",
          name: "New Basis",
          category: "acquisition",
          behavior: "per_customer",
          inputValue: "10",
          customerCountBasis: "new_customers",
        },
        {
          id: "paying-basis",
          name: "Paying Basis",
          category: "fulfillment",
          behavior: "per_customer",
          inputValue: "10",
          customerCountBasis: "total_paying_customers",
        },
      ],
    }),
  );

  assert.equal(availableValue(result.expensesByCategory.acquisition), "30");
  assert.equal(availableValue(result.expensesByCategory.fulfillment), "80");
  assert.equal(availableValue(result.variableCosts), "110");
  assert.deepEqual(availableValue(result.acquisitionCac), ratio("10", "1"));
  assert.deepEqual(availableValue(result.ultimateCac), ratio("110", "3"));
});

test("variable-cost classification follows behavior rather than expense category", () => {
  const result = calculateCoreFinancials(
    input({
      expenses: [
        {
          id: "variable-acquisition",
          name: "Variable Acquisition",
          category: "acquisition",
          behavior: "per_customer",
          inputValue: "5",
          customerCountBasis: "new_customers",
        },
        {
          id: "fixed-fulfillment",
          name: "Fixed Fulfillment",
          category: "fulfillment",
          behavior: "fixed_monthly",
          inputValue: "200",
        },
      ],
    }),
  );

  assert.equal(availableValue(result.variableCosts), "50");
  assert.equal(availableValue(result.allBusinessCosts), "250");
  assert.equal(availableValue(result.contributionProfit), "950");
  assert.equal(availableValue(result.realNetProfit), "750");
});

test("a missing fixed expense makes profit unavailable but does not contaminate contribution economics", () => {
  const result = calculateCoreFinancials(
    input({
      expenses: [
        {
          id: "unknown-rent",
          name: "Unknown Rent",
          category: "overhead",
          behavior: "fixed_monthly",
          inputValue: null,
        },
        {
          id: "known-variable",
          name: "Known Variable",
          category: "fulfillment",
          behavior: "per_customer",
          inputValue: "10",
          customerCountBasis: "total_paying_customers",
        },
      ],
    }),
  );

  assert.deepEqual(result.expensesByCategory.overhead, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });
  assert.deepEqual(result.allBusinessCosts, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.realNetProfit, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.realNetProfitMargin, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });

  assert.equal(availableValue(result.variableCosts), "200");
  assert.equal(availableValue(result.contributionProfit), "800");
  assert.deepEqual(availableValue(result.contributionMargin), ratio("4", "5"));
});

test("a missing variable expense makes both all-cost and contribution outputs unavailable", () => {
  const result = calculateCoreFinancials(
    input({
      expenses: [
        {
          id: "unknown-variable",
          name: "Unknown Variable",
          category: "fulfillment",
          behavior: "per_customer",
          inputValue: null,
          customerCountBasis: "total_paying_customers",
        },
      ],
    }),
  );

  assert.deepEqual(result.variableCosts, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.contributionProfit, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.contributionMargin, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.allBusinessCosts, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.realNetProfit, { available: false, reason: "INPUT_UNAVAILABLE" });
});

test("missing revenue components propagate as unavailable instead of being silently treated as zero", () => {
  const result = calculateCoreFinancials(
    input({
      revenueStreams: [
        {
          id: "known",
          name: "Known",
          streamType: "other",
          grossCashCollected: "1000",
          refunds: "0",
        },
        {
          id: "unknown",
          name: "Unknown",
          streamType: "other",
          grossCashCollected: null,
          refunds: "0",
        },
      ],
      canonicalAdSpend: "100",
    }),
  );

  assert.deepEqual(result.grossCashCollected, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.netCashCollected, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.realNetProfit, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.revenuePerNewCustomer, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });

  assert.deepEqual(availableValue(result.mediaCac), ratio("10", "1"));
});

test("missing unallocated values are also material missing inputs, not implicit zeroes", () => {
  const missingGross = calculateCoreFinancials(input({ unallocatedGrossCashCollected: null }));
  assert.deepEqual(missingGross.grossCashCollected, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });

  const missingRefunds = calculateCoreFinancials(input({ unallocatedRefunds: null }));
  assert.deepEqual(missingRefunds.refunds, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });
  assert.deepEqual(missingRefunds.netCashCollected, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });
});

test("zero denominator reasons take precedence when the canonical denominator is explicitly zero", () => {
  const noCustomers = calculateCoreFinancials(
    input({
      newCustomers: 0,
      totalPayingCustomers: 0,
      canonicalAdSpend: undefined,
      expenses: [
        {
          id: "missing-acquisition",
          name: "Missing Acquisition",
          category: "acquisition",
          behavior: "fixed_monthly",
          inputValue: null,
        },
      ],
    }),
  );

  assert.deepEqual(noCustomers.mediaCac, { available: false, reason: "NO_NEW_CUSTOMERS" });
  assert.deepEqual(noCustomers.acquisitionCac, {
    available: false,
    reason: "NO_NEW_CUSTOMERS",
  });
  assert.deepEqual(noCustomers.ultimateCac, {
    available: false,
    reason: "NO_NEW_CUSTOMERS",
  });
  assert.deepEqual(noCustomers.revenuePerNewCustomer, {
    available: false,
    reason: "NO_NEW_CUSTOMERS",
  });
  assert.deepEqual(noCustomers.revenuePerPayingCustomer, {
    available: false,
    reason: "NO_PAYING_CUSTOMERS",
  });

  const nonPositiveNet = calculateCoreFinancials(
    input({
      revenueStreams: [
        {
          id: "zero-net",
          name: "Zero Net",
          streamType: "other",
          grossCashCollected: "100",
          refunds: "100",
        },
      ],
      expenses: [
        {
          id: "missing-overhead",
          name: "Missing Overhead",
          category: "overhead",
          behavior: "fixed_monthly",
          inputValue: null,
        },
      ],
    }),
  );

  assert.deepEqual(nonPositiveNet.realNetProfitMargin, {
    available: false,
    reason: "NON_POSITIVE_NET_CASH",
  });
  assert.deepEqual(nonPositiveNet.contributionMargin, {
    available: false,
    reason: "NON_POSITIVE_NET_CASH",
  });
});

test("missing counts only block metrics and expenses that actually depend on those counts", () => {
  const result = calculateCoreFinancials(
    input({
      newCustomers: null,
      totalPayingCustomers: 20,
      expenses: [
        {
          id: "paying-variable",
          name: "Paying Variable",
          category: "fulfillment",
          behavior: "per_customer",
          inputValue: "10",
          customerCountBasis: "total_paying_customers",
        },
      ],
    }),
  );

  assert.equal(availableValue(result.expensesByCategory.fulfillment), "200");
  assert.equal(availableValue(result.realNetProfit), "800");
  assert.deepEqual(availableValue(result.revenuePerPayingCustomer), ratio("50", "1"));

  assert.deepEqual(result.returningCustomers, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.acquisitionCac, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.ultimateCac, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.revenuePerNewCustomer, {
    available: false,
    reason: "INPUT_UNAVAILABLE",
  });
});

test("ROAS accepts negative attributed net cash when real attribution exists", () => {
  const result = calculateCoreFinancials(
    input({ canonicalAdSpend: "200", attributedRevenue: "-100" }),
  );

  assert.deepEqual(availableValue(result.roas), ratio("-1", "2"));
});

test("exact fractions are reduced and money strings normalize trailing zeroes", () => {
  const result = calculateCoreFinancials(
    input({
      revenueStreams: [
        {
          id: "normalized",
          name: "Normalized",
          streamType: "other",
          grossCashCollected: "100.0000",
          refunds: "0.000",
        },
      ],
      newCustomers: 3,
      totalPayingCustomers: 3,
      canonicalAdSpend: "25.00",
    }),
  );

  assert.equal(availableValue(result.netCashCollected), "100");
  assert.deepEqual(availableValue(result.revenuePerNewCustomer), ratio("100", "3"));
  assert.deepEqual(availableValue(result.mediaCac), ratio("25", "3"));
  assert.deepEqual(availableValue(result.mer), ratio("4", "1"));
});

const invalidExpenseShapes: Array<{ name: string; expense: MonthlyExpenseCalculationInput }> = [
  {
    name: "per-customer without basis",
    expense: {
      id: "missing-basis",
      name: "Missing Basis",
      category: "fulfillment",
      behavior: "per_customer",
      inputValue: "10",
      customerCountBasis: null,
    },
  },
  {
    name: "fixed monthly with customer basis",
    expense: {
      id: "fixed-with-basis",
      name: "Fixed With Basis",
      category: "overhead",
      behavior: "fixed_monthly",
      inputValue: "10",
      customerCountBasis: "new_customers",
    },
  },
  {
    name: "percentage revenue with customer basis",
    expense: {
      id: "percentage-with-basis",
      name: "Percentage With Basis",
      category: "financial",
      behavior: "percentage_revenue",
      inputValue: "0.1",
      customerCountBasis: "total_paying_customers",
    },
  },
];

for (const invalid of invalidExpenseShapes) {
  test(`invalid expense shape is rejected: ${invalid.name}`, () => {
    assert.throws(
      () => calculateCoreFinancials(input({ expenses: [invalid.expense] })),
      CalculationInputError,
    );
  });
}

test("invalid decimal, negative monetary inputs, and invalid counts fail closed", () => {
  assert.throws(
    () =>
      calculateCoreFinancials(
        input({
          revenueStreams: [
            {
              id: "exponent",
              name: "Exponent",
              streamType: "other",
              grossCashCollected: "1e3",
              refunds: "0",
            },
          ],
        }),
      ),
    /canonical decimal string/,
  );

  assert.throws(
    () => calculateCoreFinancials(input({ canonicalAdSpend: "-1" })),
    /cannot be negative/,
  );

  assert.throws(
    () =>
      calculateCoreFinancials(
        input({
          expenses: [
            {
              id: "negative-expense",
              name: "Negative Expense",
              category: "overhead",
              behavior: "fixed_monthly",
              inputValue: "-1",
            },
          ],
        }),
      ),
    /cannot be negative/,
  );

  assert.throws(() => calculateCoreFinancials(input({ newCustomers: -1 })), /non-negative safe integer/);
  assert.throws(() => calculateCoreFinancials(input({ newCustomers: 1.5 })), /non-negative safe integer/);
  assert.throws(
    () => calculateCoreFinancials(input({ newCustomers: Number.MAX_SAFE_INTEGER + 1 })),
    /non-negative safe integer/,
  );
  assert.throws(
    () => calculateCoreFinancials(input({ newCustomers: 21, totalPayingCustomers: 20 })),
    /newCustomers cannot exceed totalPayingCustomers/,
  );
});

test("unsupported runtime category and behavior values fail closed even if TypeScript is bypassed", () => {
  const unsupportedCategory = {
    id: "bad-category",
    name: "Bad Category",
    category: "other",
    behavior: "fixed_monthly",
    inputValue: "10",
  } as unknown as MonthlyExpenseCalculationInput;

  assert.throws(
    () => calculateCoreFinancials(input({ expenses: [unsupportedCategory] })),
    /Unsupported expense category/,
  );

  const unsupportedBehavior = {
    id: "bad-behavior",
    name: "Bad Behavior",
    category: "overhead",
    behavior: "daily",
    inputValue: "10",
  } as unknown as MonthlyExpenseCalculationInput;

  assert.throws(
    () => calculateCoreFinancials(input({ expenses: [unsupportedBehavior] })),
    /Unsupported expense behavior/,
  );
});
