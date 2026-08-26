import assert from "node:assert/strict";
import test from "node:test";

import type { ExactRatio } from "../../src/lib/business/calculations.ts";
import {
  reverseEngineerFunnel,
  FunnelReverseEngineeringInputError,
} from "../../src/lib/business/funnel-reverse-engineering.ts";

function ratio(numerator: number | string, denominator: number | string = 1): ExactRatio {
  return { numerator: String(numerator), denominator: String(denominator) };
}

const standardRates = {
  bookingRate: ratio(1, 2),
  showRate: ratio(4, 5),
  qualificationRate: ratio(3, 4),
  closeRate: ratio(2, 5),
  saleToNewCustomerRate: ratio(5, 6),
};

test("Task 30 reverse-engineers the full funnel from 50 required customers", () => {
  const result = reverseEngineerFunnel({
    requiredCustomers: 50,
    ...standardRates,
  });

  assert.deepEqual(result, {
    requiredCustomers: 50,
    requiredSales: 60,
    requiredQualifiedCalls: 150,
    requiredShows: 200,
    requiredBookings: 250,
    requiredLeads: 500,
  });
});

test("Task 30 rounds upward at every stage instead of rounding only once at the end", () => {
  const result = reverseEngineerFunnel({
    requiredCustomers: 59,
    ...standardRates,
  });

  assert.deepEqual(result, {
    requiredCustomers: 59,
    requiredSales: 71,
    requiredQualifiedCalls: 178,
    requiredShows: 238,
    requiredBookings: 298,
    requiredLeads: 596,
  });
});

test("Task 30 supports exact 100% conversion without changing counts", () => {
  const fullRate = ratio(1, 1);
  const result = reverseEngineerFunnel({
    requiredCustomers: 7,
    bookingRate: fullRate,
    showRate: fullRate,
    qualificationRate: fullRate,
    closeRate: fullRate,
    saleToNewCustomerRate: fullRate,
  });

  assert.deepEqual(result, {
    requiredCustomers: 7,
    requiredSales: 7,
    requiredQualifiedCalls: 7,
    requiredShows: 7,
    requiredBookings: 7,
    requiredLeads: 7,
  });
});

test("Task 30 rejects a zero conversion rate instead of inventing an upstream volume", () => {
  assert.throws(
    () =>
      reverseEngineerFunnel({
        requiredCustomers: 10,
        ...standardRates,
        closeRate: ratio(0, 1),
      }),
    (error: unknown) =>
      error instanceof FunnelReverseEngineeringInputError &&
      /closeRate must be greater than 0%/.test(error.message),
  );
});

test("Task 30 rejects conversion rates above 100%", () => {
  assert.throws(
    () =>
      reverseEngineerFunnel({
        requiredCustomers: 10,
        ...standardRates,
        bookingRate: ratio(101, 100),
      }),
    /bookingRate cannot exceed 100%/,
  );
});

test("Task 30 rejects non-positive or unsafe required-customer counts", () => {
  assert.throws(
    () => reverseEngineerFunnel({ requiredCustomers: 0, ...standardRates }),
    /requiredCustomers must be a positive safe integer/,
  );
  assert.throws(
    () =>
      reverseEngineerFunnel({
        requiredCustomers: Number.MAX_SAFE_INTEGER + 1,
        ...standardRates,
      }),
    /requiredCustomers must be a positive safe integer/,
  );
});

test("Task 30 fails closed when an upstream count exceeds the safe integer boundary", () => {
  assert.throws(
    () =>
      reverseEngineerFunnel({
        requiredCustomers: Number.MAX_SAFE_INTEGER,
        bookingRate: ratio(1, 1),
        showRate: ratio(1, 1),
        qualificationRate: ratio(1, 1),
        closeRate: ratio(1, 1),
        saleToNewCustomerRate: ratio(1, 2),
      }),
    /requiredSales exceeds the safe integer planning boundary/,
  );
});
