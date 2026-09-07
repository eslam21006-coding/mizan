import assert from "node:assert/strict";
import test from "node:test";
import { prepareTransactionImportRows } from "../../src/lib/business/transaction-import.ts";
import { validateTransactionImportRows } from "../../src/lib/business/transaction-import-validation.ts";

test("partial import distinguishes ignored detail rows, invalid rows, and issue entries", () => {
  const result = validateTransactionImportRows(
    [
      {
        rowNumber: 2,
        customerEmail: "valid@example.com",
        transactionDate: "2026-08-23",
        amountCollected: "125",
        currency: "USD",
      },
      {
        rowNumber: 3,
        customerEmail: "wrong-currency@example.com",
        transactionDate: "2026-08-24",
        amountCollected: "",
        currency: "JOD",
      },
      {
        rowNumber: 4,
        customerEmail: "",
        transactionDate: "2026-08-25",
        amountCollected: "50",
        currency: "USD",
      },
      {
        rowNumber: 5,
        customerEmail: "gateway detail text",
        transactionDate: "",
        amountCollected: "",
        currency: "USD",
      },
    ],
    { baseCurrency: "USD" },
  );

  assert.equal(result.checkedRows, 3);
  assert.equal(result.validRows, 1);
  assert.equal(result.invalidRows, 2);
  assert.equal(result.issueCount, 3);
  assert.equal(result.ignoredDetailRows, 1);
  assert.equal(result.isValid, false);
  assert.deepEqual(result.importableRows.map((row) => row.rowNumber), [2]);
  assert.deepEqual(
    result.issues.map((issue) => [issue.rowNumber, issue.code]),
    [
      [3, "AMOUNT_REQUIRED"],
      [3, "CURRENCY_MISMATCH"],
      [4, "EMAIL_REQUIRED"],
    ],
  );

  const prepared = prepareTransactionImportRows(result.importableRows, {
    skipFirstRow: false,
    transactionType: "collection",
    baseCurrency: "USD",
    createImportRowToken: () => "token-1",
  });

  assert.equal(prepared.length, 1);
  assert.equal(prepared[0]?.row_number, 2);
  assert.equal(prepared[0]?.currency, "USD");
});

test("validated importable rows are already header-filtered and must not lose the first valid purchase", () => {
  const result = validateTransactionImportRows(
    [
      {
        rowNumber: 1,
        customerEmail: "Email",
        transactionDate: "Date",
        amountCollected: "Amount",
        currency: "Currency",
      },
      {
        rowNumber: 2,
        customerEmail: "first@example.com",
        transactionDate: "2026-08-23",
        amountCollected: "10",
        currency: "USD",
      },
      {
        rowNumber: 3,
        customerEmail: "second@example.com",
        transactionDate: "2026-08-24",
        amountCollected: "20",
        currency: "USD",
      },
      {
        rowNumber: 4,
        customerEmail: "bad@example.com",
        transactionDate: "2026-08-25",
        amountCollected: "",
        currency: "USD",
      },
    ],
    { skipFirstRow: true, baseCurrency: "USD" },
  );

  assert.equal(result.skippedHeaderRows, 1);
  assert.deepEqual(result.importableRows.map((row) => row.rowNumber), [2, 3]);

  let token = 0;
  const prepared = prepareTransactionImportRows(result.importableRows, {
    skipFirstRow: false,
    transactionType: "collection",
    baseCurrency: "USD",
    createImportRowToken: () => `token-${++token}`,
  });

  assert.deepEqual(prepared.map((row) => row.row_number), [2, 3]);
});
