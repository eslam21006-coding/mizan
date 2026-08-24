import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidTransactionImportSource,
  normalizeTransactionImportSource,
  normalizeTransactionId,
  prepareTransactionImportRows,
  transactionImportChunks,
  TransactionImportPreparationError,
} from "../../src/lib/business/transaction-import.ts";

test("Task 20 normalizes import sources and transaction IDs deterministically", () => {
  assert.equal(normalizeTransactionImportSource(" Stripe "), "stripe");
  assert.equal(normalizeTransactionId(" txn_123 "), "txn_123");
  assert.equal(normalizeTransactionId("   "), null);
  assert.equal(isValidTransactionImportSource("PayPal"), true);
  assert.equal(isValidTransactionImportSource("   "), false);
  assert.equal(isValidTransactionImportSource("x".repeat(81)), false);
});

test("Task 20 prepares validated rows using normalized fallback identity inputs", () => {
  const rows = prepareTransactionImportRows([
    {
      rowNumber: 1,
      customerEmail: " Buyer@Example.com ",
      transactionDate: "2026-08-24T14:30:00Z",
      amountCollected: "1,250.50",
      transactionId: " txn_123 ",
    },
  ]);

  assert.deepEqual(rows, [
    {
      row_number: 1,
      transaction_id: "txn_123",
      customer_email: "buyer@example.com",
      transaction_date: "2026-08-24",
      amount_collected: "1250.50",
    },
  ]);
});

test("Task 20 preserves no-ID rows for the email/date/amount/source database fallback key", () => {
  const rows = prepareTransactionImportRows([
    {
      rowNumber: 7,
      customerEmail: "buyer@example.com",
      transactionDate: "2026-08-24",
      amountCollected: "100",
      transactionId: "",
    },
  ]);

  assert.equal(rows[0]?.transaction_id, null);
  assert.equal(rows[0]?.customer_email, "buyer@example.com");
  assert.equal(rows[0]?.transaction_date, "2026-08-24");
  assert.equal(rows[0]?.amount_collected, "100");
});

test("Task 20 applies explicit header skipping before preparing rows", () => {
  const rows = prepareTransactionImportRows(
    [
      {
        rowNumber: 1,
        customerEmail: "Customer Email",
        transactionDate: "Transaction Date",
        amountCollected: "Amount Collected",
        transactionId: "Transaction ID",
      },
      {
        rowNumber: 2,
        customerEmail: "buyer@example.com",
        transactionDate: "2026-08-24",
        amountCollected: "25",
        transactionId: "txn_25",
      },
    ],
    { skipFirstRow: true },
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.row_number, 2);
});

test("Task 20 refuses rows that have not passed the required validation contract", () => {
  assert.throws(
    () =>
      prepareTransactionImportRows([
        {
          rowNumber: 1,
          customerEmail: "not-an-email",
          transactionDate: "2026-08-24",
          amountCollected: "10",
        },
      ]),
    (error: unknown) =>
      error instanceof TransactionImportPreparationError && error.code === "ROW_NOT_VALIDATED",
  );
});

test("Task 20 refuses oversized transaction IDs before any import RPC", () => {
  assert.throws(
    () =>
      prepareTransactionImportRows([
        {
          rowNumber: 12,
          customerEmail: "buyer@example.com",
          transactionDate: "2026-08-24",
          amountCollected: "10",
          transactionId: "x".repeat(513),
        },
      ]),
    (error: unknown) =>
      error instanceof TransactionImportPreparationError &&
      error.code === "TRANSACTION_ID_TOO_LONG" &&
      error.rowNumber === 12,
  );
});

test("Task 20 chunks large imports at the database RPC boundary", () => {
  const rows = Array.from({ length: 1_201 }, (_, index) => index);
  const chunks = transactionImportChunks(rows);

  assert.deepEqual(chunks.map((chunk) => chunk.length), [500, 500, 201]);
  assert.equal(chunks.flat().length, rows.length);
  assert.throws(() => transactionImportChunks(rows, 0), RangeError);
});
