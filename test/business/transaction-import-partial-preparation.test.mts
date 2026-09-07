import assert from "node:assert/strict";
import test from "node:test";
import { prepareTransactionImportRows } from "../../src/lib/business/transaction-import.ts";
import { validateTransactionImportRows } from "../../src/lib/business/transaction-import-validation.ts";

test("partial import keeps positive collections when zero or negative rows are unusable", () => {
  const sourceRows = [
    {
      rowNumber: 2,
      customerEmail: "valid@example.com",
      transactionDate: "2026-09-07",
      amountCollected: "10",
      currency: "EGP",
    },
    {
      rowNumber: 3,
      customerEmail: "zero@example.com",
      transactionDate: "2026-09-07",
      amountCollected: "0",
      currency: "EGP",
    },
    {
      rowNumber: 4,
      customerEmail: "negative@example.com",
      transactionDate: "2026-09-07",
      amountCollected: "-5",
      currency: "EGP",
    },
  ];

  const reviewed = validateTransactionImportRows(sourceRows, { baseCurrency: "EGP" });
  assert.equal(reviewed.validRows, 2);
  assert.equal(reviewed.invalidRows, 1);
  assert.deepEqual(reviewed.issues.map((issue) => issue.code), ["AMOUNT_INVALID"]);
  assert.deepEqual(reviewed.importableRows.map((row) => row.rowNumber), [2, 4]);

  let token = 0;
  const prepared = prepareTransactionImportRows(reviewed.importableRows, {
    transactionType: "collection",
    baseCurrency: "EGP",
    createImportRowToken: () => `token-${++token}`,
  });

  assert.deepEqual(prepared.map((row) => row.row_number), [2]);
  assert.equal(prepared[0]?.amount_collected, "10");
  assert.equal(token, 1);
});
