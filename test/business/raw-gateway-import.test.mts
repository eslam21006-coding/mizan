import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeGatewayTransactionRows,
  normalizeTransactionDateForImport,
  TransactionGatewayNormalizationError,
  validateTransactionImportRows,
  type TransactionValidationInputRow,
} from "../../src/lib/business/transaction-import-validation.ts";
import { prepareTransactionImportRows } from "../../src/lib/business/transaction-import.ts";
import { readTransactionValidationSource } from "../../src/lib/business/transaction-validation-source.ts";
import { asArrayBuffer } from "../helpers/zip-crc.ts";

function rawGatewayRows(): Promise<TransactionValidationInputRow[]> {
  const bytes = readFileSync("test/fixtures/raw-gateway-line-items.csv");
  return readTransactionValidationSource({
    fileName: "raw-gateway-line-items.csv",
    fileSize: bytes.length,
    buffer: asArrayBuffer(bytes),
    columns: [1, 5, 3, 0, 2],
  }).then((source) =>
    source.rows.map((row) => ({
      rowNumber: row.rowNumber,
      customerEmail: row.values[0] ?? "",
      transactionDate: row.values[1] ?? "",
      amountCollected: row.values[2] ?? "",
      transactionId: row.values[3] ?? "",
      currency: row.values[4] ?? "",
    })),
  );
}

test("raw gateway fixture collapses line items into transaction-level cash rows", async () => {
  const rows = await rawGatewayRows();
  const normalized = normalizeGatewayTransactionRows(rows, { skipFirstRow: true });

  assert.equal(rows.length, 8);
  assert.equal(normalized.skippedHeaderRows, 1);
  assert.equal(normalized.collapsedSourceRows, 2);
  assert.equal(normalized.ignoredNonCashRows, 1);
  assert.equal(normalized.ignoredNonCashTransactions, 1);
  assert.equal(normalized.rows.length, 4);
  assert.deepEqual(
    normalized.rows.map((row) => ({
      transactionId: row.transactionId,
      email: row.customerEmail,
      date: row.transactionDate,
      amount: row.amountCollected,
      currency: row.currency,
    })),
    [
      { transactionId: "tx_100", email: "first@example.com", date: "2026-08-27", amount: "29", currency: "USD" },
      { transactionId: "tx_101", email: "second@example.com", date: "2026-08-27", amount: "27", currency: "USD" },
      { transactionId: "tx_103", email: "repeat@example.com", date: "2026-08-28", amount: "9", currency: "USD" },
      { transactionId: "tx_104", email: "repeat@example.com", date: "2026-08-28", amount: "27", currency: "USD" },
    ],
  );
  assert.equal(
    normalized.rows.reduce((sum, row) => sum + Number(row.amountCollected), 0),
    92,
  );
});

test("raw gateway validation reports transaction counts rather than line-item counts", async () => {
  const rows = await rawGatewayRows();
  const result = validateTransactionImportRows(rows, {
    skipFirstRow: true,
    baseCurrency: "USD",
  });

  assert.equal(result.totalSourceRows, 8);
  assert.equal(result.checkedRows, 4);
  assert.equal(result.validRows, 4);
  assert.equal(result.invalidRows, 0);
  assert.equal(result.collapsedSourceRows, 2);
  assert.equal(result.ignoredNonCashRows, 1);
  assert.equal(result.ignoredNonCashTransactions, 1);
  assert.equal(result.isValid, true);
});

test("raw gateway preparation imports each transaction id once and keeps separate upsell transactions", async () => {
  const rows = await rawGatewayRows();
  let token = 0;
  const prepared = prepareTransactionImportRows(rows, {
    skipFirstRow: true,
    transactionType: "collection",
    baseCurrency: "USD",
    createImportRowToken: () => `token-${++token}`,
  });

  assert.equal(prepared.length, 4);
  assert.deepEqual(
    prepared.map((row) => row.transaction_id),
    ["tx_100", "tx_101", "tx_103", "tx_104"],
  );
  assert.deepEqual(
    prepared.filter((row) => row.customer_email === "repeat@example.com").map((row) => row.transaction_id),
    ["tx_103", "tx_104"],
  );
  assert.deepEqual(prepared.map((row) => row.transaction_date), [
    "2026-08-27",
    "2026-08-27",
    "2026-08-28",
    "2026-08-28",
  ]);
});

test("raw gateway grouping rejects conflicting transaction-level values instead of guessing", () => {
  const rows: TransactionValidationInputRow[] = [
    {
      rowNumber: 1,
      customerEmail: "buyer@example.com",
      transactionDate: "27-Aug-26",
      amountCollected: "29",
      transactionId: "tx_conflict",
      currency: "USD",
    },
    {
      rowNumber: 2,
      customerEmail: "buyer@example.com",
      transactionDate: "27-Aug-26",
      amountCollected: "39",
      transactionId: "tx_conflict",
      currency: "USD",
    },
  ];

  assert.throws(
    () => normalizeGatewayTransactionRows(rows),
    (error: unknown) =>
      error instanceof TransactionGatewayNormalizationError &&
      error.transactionId === "tx_conflict" &&
      error.field === "amountCollected" &&
      error.rowNumbers.join(",") === "1,2",
  );
});

test("gateway date normalization supports explicit English month exports without accepting ambiguous slash dates", () => {
  assert.equal(normalizeTransactionDateForImport("28-Aug-26"), "2026-08-28");
  assert.equal(normalizeTransactionDateForImport("7-Sep-2026"), "2026-09-07");
  assert.equal(normalizeTransactionDateForImport("31-Feb-26"), null);
  assert.equal(normalizeTransactionDateForImport("28/08/2026"), null);
});

test("grouping preserves the optional-currency path when no currency column is mapped", () => {
  const rows: TransactionValidationInputRow[] = [
    {
      rowNumber: 1,
      customerEmail: "buyer@example.com",
      transactionDate: "28-Aug-26",
      amountCollected: "29",
      transactionId: "tx_no_currency",
    },
    {
      rowNumber: 2,
      customerEmail: "buyer@example.com",
      transactionDate: "",
      amountCollected: "",
      transactionId: "tx_no_currency",
    },
  ];

  const normalized = normalizeGatewayTransactionRows(rows);
  assert.equal(normalized.rows.length, 1);
  assert.equal(normalized.rows[0]?.currency, undefined);
  assert.equal(validateTransactionImportRows(rows, { baseCurrency: "USD" }).isValid, true);
});
