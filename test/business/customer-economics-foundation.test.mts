import assert from "node:assert/strict";
import test from "node:test";

import {
  assertUniqueAuthoritativeCostSources,
  buildCustomerEconomicsCostPoolFoundation,
  classifyCustomerEconomicsCost,
  evaluateCustomerRevenueCoverage,
  reconcileAuthoritativeCostPool,
} from "../../src/lib/business/customer-economics-foundation.ts";
import {
  compareRationals,
  rationalFromDecimalString,
} from "../../src/lib/business/exact-rational.ts";

test("Task 1 eligibility keeps fixed acquisition in customer economics", () => {
  assert.deepEqual(
    classifyCustomerEconomicsCost({ category: "acquisition", behavior: "fixed_monthly" }),
    { eligibility: "eligible", defaultDriver: "new_customers", reason: "ACQUISITION_COST" },
  );
});

test("Task 1 eligibility excludes fixed non-customer-linked costs", () => {
  for (const [category, reason] of [
    ["fulfillment", "FIXED_FULFILLMENT"],
    ["overhead", "FIXED_OVERHEAD"],
    ["financial", "FIXED_FINANCIAL"],
  ] as const) {
    assert.deepEqual(classifyCustomerEconomicsCost({ category, behavior: "fixed_monthly" }), {
      eligibility: "excluded",
      defaultDriver: "none",
      reason,
    });
  }
});

test("Task 1 variable behavior maps only to observable V1 drivers", () => {
  assert.equal(
    classifyCustomerEconomicsCost({
      category: "fulfillment",
      behavior: "per_customer",
      customerBasis: "new_customers",
    }).defaultDriver,
    "new_customers",
  );
  assert.equal(
    classifyCustomerEconomicsCost({
      category: "financial",
      behavior: "per_customer",
      customerBasis: "total_paying_customers",
    }).defaultDriver,
    "paying_customers",
  );
  assert.equal(
    classifyCustomerEconomicsCost({ category: "overhead", behavior: "percentage_revenue" })
      .defaultDriver,
    "positive_collected_cash",
  );
  assert.deepEqual(
    classifyCustomerEconomicsCost({ category: "fulfillment", behavior: "per_customer" }),
    { eligibility: "eligible", defaultDriver: "none", reason: "MISSING_CUSTOMER_BASIS" },
  );
});

test("Task 1 cost pools preserve missing versus explicit zero", () => {
  const base = {
    authoritativeSourceId: "expense-entry-1",
    businessId: "business-1",
    activityMonth: "2026-08-01",
    expenseItemId: "expense-1",
    expenseNameSnapshot: "Processor",
    categorySnapshot: "financial" as const,
    behaviorSnapshot: "percentage_revenue" as const,
    customerBasisSnapshot: null,
  };

  const missing = buildCustomerEconomicsCostPoolFoundation({
    ...base,
    authoritativeAmount: { available: false, reason: "INPUT_UNAVAILABLE" },
  });
  assert.equal(missing.amountState, "missing");
  assert.equal(missing.authoritativeAmount, null);

  const zero = buildCustomerEconomicsCostPoolFoundation({
    ...base,
    authoritativeSourceId: "expense-entry-2",
    authoritativeAmount: { available: true, value: "0" },
  });
  assert.equal(zero.amountState, "actual");
  assert.equal(zero.authoritativeAmount, "0");
});

test("Task 1 rejects duplicate authoritative monetary sources", () => {
  const pool = buildCustomerEconomicsCostPoolFoundation({
    authoritativeSourceId: "monthly-expense-1",
    businessId: "business-1",
    activityMonth: "2026-08-01",
    expenseItemId: "expense-1",
    expenseNameSnapshot: "Meta Ads",
    categorySnapshot: "acquisition",
    behaviorSnapshot: "fixed_monthly",
    authoritativeAmount: { available: true, value: "8000" },
  });

  assert.throws(
    () => assertUniqueAuthoritativeCostSources([pool, pool]),
    /Duplicate authoritative cost source/,
  );
});

test("Task 1 coverage tolerance uses max of one currency unit or 0.1 percent", () => {
  const withinTolerance = evaluateCustomerRevenueCoverage("20000", "19995");
  assert.equal(withinTolerance.blocking, false);
  assert.equal(compareRationals(withinTolerance.difference, rationalFromDecimalString("5")), 0);
  assert.equal(compareRationals(withinTolerance.tolerance, rationalFromDecimalString("20")), 0);

  const blocking = evaluateCustomerRevenueCoverage("20000", "19950");
  assert.equal(blocking.blocking, true);
  assert.equal(compareRationals(blocking.difference, rationalFromDecimalString("50")), 0);

  const floor = evaluateCustomerRevenueCoverage("500", "499.5");
  assert.equal(floor.blocking, false);
  assert.equal(compareRationals(floor.tolerance, rationalFromDecimalString("1")), 0);
});

test("Task 1 coverage tolerance remains valid for zero and negative business net cash", () => {
  const zero = evaluateCustomerRevenueCoverage("0", "1");
  assert.equal(zero.blocking, false);
  assert.equal(compareRationals(zero.tolerance, rationalFromDecimalString("1")), 0);

  const negative = evaluateCustomerRevenueCoverage("-20000", "-19950");
  assert.equal(negative.blocking, true);
  assert.equal(compareRationals(negative.tolerance, rationalFromDecimalString("20")), 0);
});

test("Task 1 exact reconciliation has no floating point drift", () => {
  const exact = reconcileAuthoritativeCostPool({
    authoritativeAmount: "0.3",
    allocatedAmounts: ["0.1", "0.2"],
    unallocatedAmount: "0",
  });
  assert.equal(exact.available, true);
  if (exact.available) assert.equal(exact.reconciles, true);

  const knownPool = reconcileAuthoritativeCostPool({
    authoritativeAmount: "2000",
    allocatedAmounts: ["700", "500", "450"],
    unallocatedAmount: "350",
  });
  assert.equal(knownPool.available, true);
  if (knownPool.available) assert.equal(knownPool.reconciles, true);

  const drift = reconcileAuthoritativeCostPool({
    authoritativeAmount: "2000",
    allocatedAmounts: ["700", "500", "450"],
    unallocatedAmount: "350.00000001",
  });
  assert.equal(drift.available, true);
  if (drift.available) assert.equal(drift.reconciles, false);
});

test("Task 1 reconciliation rejects every negative cost-pool component", () => {
  assert.throws(
    () =>
      reconcileAuthoritativeCostPool({
        authoritativeAmount: "-100",
        allocatedAmounts: ["100"],
        unallocatedAmount: "0",
      }),
    /Cost pool amounts cannot be negative/,
  );

  assert.throws(
    () =>
      reconcileAuthoritativeCostPool({
        authoritativeAmount: "100",
        allocatedAmounts: ["-50", "100"],
        unallocatedAmount: "50",
      }),
    /Cost pool amounts cannot be negative/,
  );

  assert.throws(
    () =>
      reconcileAuthoritativeCostPool({
        authoritativeAmount: "100",
        allocatedAmounts: ["100"],
        unallocatedAmount: "-1",
      }),
    /Cost pool amounts cannot be negative/,
  );
});

test("Task 1 reconciliation preserves missing versus zero", () => {
  assert.deepEqual(
    reconcileAuthoritativeCostPool({
      authoritativeAmount: null,
      allocatedAmounts: [],
      unallocatedAmount: "0",
    }),
    { available: false, reason: "INPUT_UNAVAILABLE" },
  );

  const explicitZero = reconcileAuthoritativeCostPool({
    authoritativeAmount: "0",
    allocatedAmounts: [],
    unallocatedAmount: "0",
  });
  assert.equal(explicitZero.available, true);
  if (explicitZero.available) assert.equal(explicitZero.reconciles, true);
});
