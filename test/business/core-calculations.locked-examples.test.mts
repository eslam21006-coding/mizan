import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCoreFinancials,
  type CalculatedMetric,
  type CoreCalculationInput,
  type ExactRatio,
} from "../../src/lib/business/calculations.ts";

function availableValue<T>(metric: CalculatedMetric<T>) {
  assert.equal(metric.available, true);
  if (!metric.available) throw new Error(`Expected available metric, got ${metric.reason}`);
  return metric.value;
}

function ratio(numerator: string, denominator: string): ExactRatio {
  return { numerator, denominator };
}

function baseInput(overrides: Partial<CoreCalculationInput> = {}): CoreCalculationInput {
  return {
    revenueStreams: [],
    expenses: [],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers: 0,
    totalPayingCustomers: 0,
    ...overrides,
  };
}

test("locked Example A: full business month matches every core expected output", () => {
  const result = calculateCoreFinancials(
    baseInput({
      revenueStreams: [
        {
          id: "main",
          name: "Main Revenue",
          streamType: "other",
          grossCashCollected: "100000",
          refunds: "5000",
        },
      ],
      newCustomers: 50,
      totalPayingCustomers: 80,
      canonicalAdSpend: "20000",
      attributedRevenue: "60000",
      expenses: [
        {
          id: "ad-spend",
          name: "Ad Spend",
          category: "acquisition",
          behavior: "fixed_monthly",
          inputValue: "20000",
        },
        {
          id: "sales-fixed",
          name: "Sales Team",
          category: "acquisition",
          behavior: "fixed_monthly",
          inputValue: "5000",
        },
        {
          id: "sales-variable",
          name: "Sales Commission",
          category: "acquisition",
          behavior: "percentage_revenue",
          inputValue: "0.10",
        },
        {
          id: "fulfillment-fixed",
          name: "Delivery Team",
          category: "fulfillment",
          behavior: "fixed_monthly",
          inputValue: "8000",
        },
        {
          id: "fulfillment-per-customer",
          name: "Customer Materials",
          category: "fulfillment",
          behavior: "per_customer",
          inputValue: "20",
          customerCountBasis: "total_paying_customers",
        },
        {
          id: "fulfillment-percentage",
          name: "Delivery Royalty",
          category: "fulfillment",
          behavior: "percentage_revenue",
          inputValue: "0.05",
        },
        {
          id: "overhead-fixed",
          name: "Overhead",
          category: "overhead",
          behavior: "fixed_monthly",
          inputValue: "10000",
        },
        {
          id: "processor-fee",
          name: "Processor Fee",
          category: "financial",
          behavior: "percentage_revenue",
          inputValue: "0.03",
        },
        {
          id: "tax",
          name: "Tax",
          category: "financial",
          behavior: "percentage_revenue",
          inputValue: "0.05",
        },
      ],
    }),
  );

  assert.equal(availableValue(result.grossCashCollected), "100000");
  assert.equal(availableValue(result.refunds), "5000");
  assert.equal(availableValue(result.netCashCollected), "95000");
  assert.equal(availableValue(result.returningCustomers), 30);

  assert.equal(availableValue(result.expensesByCategory.acquisition), "34500");
  assert.equal(availableValue(result.expensesByCategory.fulfillment), "14350");
  assert.equal(availableValue(result.expensesByCategory.overhead), "10000");
  assert.equal(availableValue(result.expensesByCategory.financial), "7600");
  assert.equal(availableValue(result.allBusinessCosts), "66450");
  assert.equal(availableValue(result.variableCosts), "23450");

  assert.equal(availableValue(result.realNetProfit), "28550");
  assert.deepEqual(availableValue(result.realNetProfitMargin), ratio("571", "1900"));
  assert.equal(availableValue(result.contributionProfit), "71550");
  assert.deepEqual(availableValue(result.contributionMargin), ratio("1431", "1900"));

  assert.deepEqual(availableValue(result.mediaCac), ratio("400", "1"));
  assert.deepEqual(availableValue(result.acquisitionCac), ratio("690", "1"));
  assert.deepEqual(availableValue(result.ultimateCac), ratio("1329", "1"));
  assert.deepEqual(availableValue(result.revenuePerPayingCustomer), ratio("2375", "2"));
  assert.deepEqual(availableValue(result.revenuePerNewCustomer), ratio("1900", "1"));
  assert.deepEqual(availableValue(result.mer), ratio("19", "4"));
  assert.deepEqual(availableValue(result.roas), ratio("3", "1"));
});

test("locked Example B: refund-heavy month keeps negative net cash and floors percentage expenses at zero", () => {
  const result = calculateCoreFinancials(
    baseInput({
      revenueStreams: [
        {
          id: "refund-heavy",
          name: "Refund Heavy",
          streamType: "other",
          grossCashCollected: "10000",
          refunds: "12000",
        },
      ],
      newCustomers: 2,
      totalPayingCustomers: 3,
      canonicalAdSpend: "1000",
      expenses: [
        {
          id: "ads",
          name: "Ads",
          category: "acquisition",
          behavior: "fixed_monthly",
          inputValue: "1000",
        },
        {
          id: "overhead",
          name: "Overhead",
          category: "overhead",
          behavior: "fixed_monthly",
          inputValue: "3000",
        },
        {
          id: "processor",
          name: "Processor",
          category: "financial",
          behavior: "percentage_revenue",
          inputValue: "0.10",
        },
      ],
    }),
  );

  assert.equal(availableValue(result.netCashCollected), "-2000");
  assert.equal(availableValue(result.expensesByCategory.financial), "0");
  assert.equal(availableValue(result.allBusinessCosts), "4000");
  assert.equal(availableValue(result.realNetProfit), "-6000");
  assert.equal(availableValue(result.variableCosts), "0");
  assert.equal(availableValue(result.contributionProfit), "-2000");

  assert.deepEqual(result.realNetProfitMargin, {
    available: false,
    reason: "NON_POSITIVE_NET_CASH",
  });
  assert.deepEqual(result.contributionMargin, {
    available: false,
    reason: "NON_POSITIVE_NET_CASH",
  });

  assert.deepEqual(availableValue(result.mediaCac), ratio("500", "1"));
  assert.deepEqual(availableValue(result.acquisitionCac), ratio("500", "1"));
  assert.deepEqual(availableValue(result.ultimateCac), ratio("2000", "1"));
  assert.deepEqual(availableValue(result.revenuePerNewCustomer), ratio("-1000", "1"));
  assert.deepEqual(availableValue(result.revenuePerPayingCustomer), ratio("-2000", "3"));
  assert.deepEqual(availableValue(result.mer), ratio("-2", "1"));
});

test("locked Example C: zero new customers disables every new-customer denominator metric", () => {
  const result = calculateCoreFinancials(
    baseInput({
      revenueStreams: [
        {
          id: "existing-customers",
          name: "Existing Customers",
          streamType: "other",
          grossCashCollected: "5000",
          refunds: "0",
        },
      ],
      newCustomers: 0,
      totalPayingCustomers: 5,
      canonicalAdSpend: "2000",
      expenses: [
        {
          id: "ads",
          name: "Ads",
          category: "acquisition",
          behavior: "fixed_monthly",
          inputValue: "2000",
        },
        {
          id: "fulfillment",
          name: "Fulfillment",
          category: "fulfillment",
          behavior: "fixed_monthly",
          inputValue: "500",
        },
        {
          id: "overhead",
          name: "Overhead",
          category: "overhead",
          behavior: "fixed_monthly",
          inputValue: "1500",
        },
      ],
    }),
  );

  assert.deepEqual(result.mediaCac, { available: false, reason: "NO_NEW_CUSTOMERS" });
  assert.deepEqual(result.acquisitionCac, { available: false, reason: "NO_NEW_CUSTOMERS" });
  assert.deepEqual(result.ultimateCac, { available: false, reason: "NO_NEW_CUSTOMERS" });
  assert.deepEqual(result.revenuePerNewCustomer, {
    available: false,
    reason: "NO_NEW_CUSTOMERS",
  });
  assert.deepEqual(availableValue(result.revenuePerPayingCustomer), ratio("1000", "1"));
  assert.deepEqual(availableValue(result.mer), ratio("5", "2"));
});

test("locked Example D: zero ad spend allows Media CAC zero but disables MER and ROAS", () => {
  const result = calculateCoreFinancials(
    baseInput({
      revenueStreams: [
        {
          id: "main",
          name: "Main",
          streamType: "other",
          grossCashCollected: "10000",
          refunds: "0",
        },
      ],
      newCustomers: 5,
      totalPayingCustomers: 5,
      canonicalAdSpend: "0",
      attributedRevenue: "3000",
    }),
  );

  assert.deepEqual(availableValue(result.mediaCac), ratio("0", "1"));
  assert.deepEqual(result.mer, { available: false, reason: "NO_AD_SPEND" });
  assert.deepEqual(result.roas, { available: false, reason: "NO_AD_SPEND" });
});

test("locked Example E: unavailable attribution never substitutes total business revenue into ROAS", () => {
  const result = calculateCoreFinancials(
    baseInput({
      revenueStreams: [
        {
          id: "main",
          name: "Main",
          streamType: "other",
          grossCashCollected: "50000",
          refunds: "0",
        },
      ],
      newCustomers: 10,
      totalPayingCustomers: 10,
      canonicalAdSpend: "10000",
      attributedRevenue: null,
    }),
  );

  assert.deepEqual(availableValue(result.mer), ratio("5", "1"));
  assert.deepEqual(result.roas, {
    available: false,
    reason: "ATTRIBUTION_UNAVAILABLE",
  });
});
