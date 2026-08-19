import assert from "node:assert/strict";
import test from "node:test";
import {
  CalculationInputError,
  calculateCoreFinancials,
  type CoreCalculationInput,
} from "../../src/lib/business/calculations.ts";

function knownBusiness(overrides: Partial<CoreCalculationInput> = {}): CoreCalculationInput {
  return {
    revenueStreams: [
      {
        id: "front",
        name: "Front End",
        streamType: "front_end",
        grossCashCollected: "10000",
        refunds: "500",
      },
      {
        id: "backend",
        name: "Backend",
        streamType: "backend",
        grossCashCollected: "4000",
        refunds: "0",
      },
    ],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers: 10,
    totalPayingCustomers: 15,
    canonicalAdSpend: "2000",
    attributedRevenue: "6000",
    expenses: [
      {
        id: "ads",
        name: "Ad Spend",
        category: "acquisition",
        behavior: "fixed_monthly",
        inputValue: "2000",
      },
      {
        id: "certificates",
        name: "Certificates",
        category: "fulfillment",
        behavior: "per_customer",
        inputValue: "20",
        customerCountBasis: "total_paying_customers",
      },
      {
        id: "rent",
        name: "Rent",
        category: "overhead",
        behavior: "fixed_monthly",
        inputValue: "1000",
      },
      {
        id: "processor",
        name: "Processor",
        category: "financial",
        behavior: "percentage_revenue",
        inputValue: "0.035",
      },
    ],
    ...overrides,
  };
}

function value<T>(metric: { available: true; value: T } | { available: false; reason: string }) {
  assert.equal(metric.available, true);
  if (!metric.available) throw new Error(`Expected available metric, got ${metric.reason}`);
  return metric.value;
}

test("calculates Task 9 core financial metrics with exact known outputs", () => {
  const result = calculateCoreFinancials(knownBusiness());

  assert.equal(value(result.grossCashCollected), "14000");
  assert.equal(value(result.refunds), "500");
  assert.equal(value(result.netCashCollected), "13500");
  assert.equal(value(result.returningCustomers), 5);

  assert.deepEqual(result.revenueByStream.map((stream) => value(stream.netCashCollected)), [
    "9500",
    "4000",
  ]);

  assert.equal(value(result.expensesByCategory.acquisition), "2000");
  assert.equal(value(result.expensesByCategory.fulfillment), "300");
  assert.equal(value(result.expensesByCategory.overhead), "1000");
  assert.equal(value(result.expensesByCategory.financial), "472.5");
  assert.equal(value(result.allBusinessCosts), "3772.5");
  assert.equal(value(result.variableCosts), "772.5");

  assert.equal(value(result.realNetProfit), "9727.5");
  assert.deepEqual(value(result.realNetProfitMargin), { numerator: "1297", denominator: "1800" });
  assert.equal(value(result.contributionProfit), "12727.5");
  assert.deepEqual(value(result.contributionMargin), { numerator: "1697", denominator: "1800" });

  assert.deepEqual(value(result.mediaCac), { numerator: "200", denominator: "1" });
  assert.deepEqual(value(result.acquisitionCac), { numerator: "200", denominator: "1" });
  assert.deepEqual(value(result.ultimateCac), { numerator: "1509", denominator: "4" });
  assert.deepEqual(value(result.revenuePerPayingCustomer), { numerator: "900", denominator: "1" });
  assert.deepEqual(value(result.revenuePerNewCustomer), { numerator: "1350", denominator: "1" });
  assert.deepEqual(value(result.mer), { numerator: "27", denominator: "4" });
  assert.deepEqual(value(result.roas), { numerator: "3", denominator: "1" });
});

test("percentage-of-revenue costs use max(net cash, 0) and never create a negative expense credit", () => {
  const result = calculateCoreFinancials(
    knownBusiness({
      revenueStreams: [
        {
          id: "only",
          name: "Only",
          streamType: "front_end",
          grossCashCollected: "100",
          refunds: "150",
        },
      ],
      expenses: [
        {
          id: "processor",
          name: "Processor",
          category: "financial",
          behavior: "percentage_revenue",
          inputValue: "0.05",
        },
      ],
      unallocatedGrossCashCollected: "0",
      unallocatedRefunds: "0",
      canonicalAdSpend: "10",
    }),
  );

  assert.equal(value(result.netCashCollected), "-50");
  assert.equal(value(result.expensesByCategory.financial), "0");
  assert.equal(value(result.realNetProfit), "-50");
  assert.deepEqual(result.realNetProfitMargin, {
    available: false,
    reason: "NON_POSITIVE_NET_CASH",
  });
  assert.deepEqual(result.contributionMargin, {
    available: false,
    reason: "NON_POSITIVE_NET_CASH",
  });
});

test("preserves missing versus explicit zero instead of fabricating totals", () => {
  const missing = calculateCoreFinancials(
    knownBusiness({
      revenueStreams: [
        {
          id: "front",
          name: "Front End",
          streamType: "front_end",
          grossCashCollected: null,
          refunds: "0",
        },
      ],
      expenses: [],
      unallocatedGrossCashCollected: "0",
      unallocatedRefunds: "0",
    }),
  );

  assert.deepEqual(missing.grossCashCollected, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(missing.netCashCollected, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(missing.realNetProfit, { available: false, reason: "INPUT_UNAVAILABLE" });

  const explicitZero = calculateCoreFinancials(
    knownBusiness({
      revenueStreams: [
        {
          id: "front",
          name: "Front End",
          streamType: "front_end",
          grossCashCollected: "0",
          refunds: "0",
        },
      ],
      expenses: [],
      unallocatedGrossCashCollected: "0",
      unallocatedRefunds: "0",
      newCustomers: 0,
      totalPayingCustomers: 0,
      canonicalAdSpend: "0",
      attributedRevenue: null,
    }),
  );

  assert.equal(value(explicitZero.netCashCollected), "0");
  assert.deepEqual(explicitZero.mediaCac, { available: false, reason: "NO_NEW_CUSTOMERS" });
  assert.deepEqual(explicitZero.revenuePerPayingCustomer, {
    available: false,
    reason: "NO_PAYING_CUSTOMERS",
  });
  assert.deepEqual(explicitZero.mer, { available: false, reason: "NO_AD_SPEND" });
  assert.deepEqual(explicitZero.roas, {
    available: false,
    reason: "ATTRIBUTION_UNAVAILABLE",
  });
});

test("does not infer ad spend from an expense item's name", () => {
  const result = calculateCoreFinancials(
    knownBusiness({
      canonicalAdSpend: undefined,
      attributedRevenue: "6000",
    }),
  );

  assert.equal(value(result.expensesByCategory.acquisition), "2000");
  assert.deepEqual(result.mediaCac, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.mer, { available: false, reason: "INPUT_UNAVAILABLE" });
  assert.deepEqual(result.roas, { available: false, reason: "INPUT_UNAVAILABLE" });
});

test("per-customer expenses require the explicit stored customer-count basis", () => {
  assert.throws(
    () =>
      calculateCoreFinancials(
        knownBusiness({
          expenses: [
            {
              id: "support",
              name: "Support",
              category: "fulfillment",
              behavior: "per_customer",
              inputValue: "30",
              customerCountBasis: null,
            },
          ],
        }),
      ),
    CalculationInputError,
  );
});

test("rejects invalid customer invariants and negative raw inputs", () => {
  assert.throws(
    () => calculateCoreFinancials(knownBusiness({ newCustomers: 16, totalPayingCustomers: 15 })),
    /newCustomers cannot exceed totalPayingCustomers/,
  );

  assert.throws(
    () =>
      calculateCoreFinancials(
        knownBusiness({
          revenueStreams: [
            {
              id: "invalid",
              name: "Invalid",
              streamType: "front_end",
              grossCashCollected: "-1",
              refunds: "0",
            },
          ],
        }),
      ),
    /cannot be negative/,
  );
});
