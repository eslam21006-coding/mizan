import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidTransactionDate,
  validateTransactionImportRows,
} from "../../src/lib/business/transaction-import-validation.ts";
import { prepareTransactionImportRows } from "../../src/lib/business/transaction-import.ts";

test("Task 20 validates mapped currency against the business base currency", () => {
  const base = {
    customerEmail: "buyer@example.com",
    transactionDate: "2026-08-25T01:30:00+03:00",
    amountCollected: "100",
  };

  const matching = validateTransactionImportRows(
    [{ rowNumber: 1, ...base, currency: " egp " }],
    { baseCurrency: "EGP" },
  );
  assert.equal(matching.isValid, true);

  const foreign = validateTransactionImportRows(
    [{ rowNumber: 1, ...base, currency: "USD" }],
    { baseCurrency: "EGP" },
  );
  assert.deepEqual(foreign.issues.map((issue) => issue.code), ["CURRENCY_MISMATCH"]);

  const blank = validateTransactionImportRows(
    [{ rowNumber: 1, ...base, currency: " " }],
    { baseCurrency: "EGP" },
  );
  assert.deepEqual(blank.issues.map((issue) => issue.code), ["CURRENCY_REQUIRED"]);
});

test("Task 20 allows an absent currency column for explicit import-level base-currency confirmation", () => {
  const result = validateTransactionImportRows(
    [{
      rowNumber: 1,
      customerEmail: "buyer@example.com",
      transactionDate: "2026-08-25",
      amountCollected: "100",
    }],
    { baseCurrency: "EGP" },
  );
  assert.equal(result.isValid, true);
});

test("Task 20 preserves the exact validated source datetime and sends explicit successful/base-currency metadata", () => {
  const prepared = prepareTransactionImportRows(
    [{
      rowNumber: 2,
      customerEmail: " Buyer@Example.com ",
      transactionDate: " 2026-08-24T23:30:00Z ",
      amountCollected: "100.00",
      currency: "EGP",
    }],
    {
      transactionType: "collection",
      baseCurrency: "EGP",
      createImportRowToken: () => "20202020-2020-4020-8020-20202020e999",
    },
  );

  assert.deepEqual(prepared[0], {
    row_number: 2,
    transaction_id: null,
    import_row_token: "20202020-2020-4020-8020-20202020e999",
    customer_email: "buyer@example.com",
    transaction_date: "2026-08-24T23:30:00Z",
    amount_collected: "100.00",
    transaction_type: "collection",
    normalized_outcome: "successful",
    currency: "EGP",
  });
});

test("Task 20 rejects impossible local or offset time components without discarding valid local datetimes", () => {
  assert.equal(isValidTransactionDate("2026-08-25T23:59:59"), true);
  assert.equal(isValidTransactionDate("2026-08-25 12:30"), true);
  assert.equal(isValidTransactionDate("2026-08-25T24:00:00"), false);
  assert.equal(isValidTransactionDate("2026-08-25T12:60:00"), false);
  assert.equal(isValidTransactionDate("2026-08-25T12:30:60"), false);
  assert.equal(isValidTransactionDate("2026-08-25T12:30:00+03:60"), false);
});
