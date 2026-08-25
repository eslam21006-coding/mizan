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
import {
  isValidTransactionDate,
  isValidTransactionEmail,
  TRANSACTION_EMAIL_MAX_LENGTH,
  TRANSACTION_ID_MAX_LENGTH,
  validateTransactionImportRows,
} from "../../src/lib/business/transaction-import-validation.ts";

const TOKEN_1 = "20202020-2020-4020-8020-20202020e001";

function prepareOptions(
  transactionType: "collection" | "refund" = "collection",
  token = TOKEN_1,
) {
  return {
    transactionType,
    baseCurrency: "EGP",
    createImportRowToken: () => token,
  } as const;
}

test("Task 20 normalizes import sources and transaction IDs deterministically", () => {
  assert.equal(normalizeTransactionImportSource(" Stripe "), "stripe");
  assert.equal(normalizeTransactionImportSource("\u00a0Stripe\u00a0"), "\u00a0stripe\u00a0");
  assert.equal(normalizeTransactionId(" txn_123 "), "txn_123");
  assert.equal(normalizeTransactionId("   "), null);
  assert.equal(isValidTransactionImportSource("PayPal"), true);
  assert.equal(isValidTransactionImportSource("   "), false);
  assert.equal(isValidTransactionImportSource("x".repeat(81)), false);
});

test("Task 20 counts Unicode code points at database character boundaries", () => {
  assert.equal(isValidTransactionImportSource("😀".repeat(80)), true);
  assert.equal(isValidTransactionImportSource("😀".repeat(81)), false);

  const exactEmail = `${"😀".repeat(315)}@b.co`;
  assert.equal(Array.from(exactEmail).length, TRANSACTION_EMAIL_MAX_LENGTH);
  assert.ok(exactEmail.length > TRANSACTION_EMAIL_MAX_LENGTH);
  assert.equal(isValidTransactionEmail(exactEmail), true);
});

test("Task 20 prepares validated collection rows with stable retry identity", () => {
  const rows = prepareTransactionImportRows(
    [
      {
        rowNumber: 1,
        customerEmail: " Buyer@Example.com ",
        transactionDate: "2026-08-24T14:30:00Z",
        amountCollected: "+1,250.50",
        transactionId: " txn_123 ",
      },
    ],
    prepareOptions(),
  );

  assert.deepEqual(rows, [
    {
      row_number: 1,
      transaction_id: "txn_123",
      import_row_token: TOKEN_1,
      customer_email: "buyer@example.com",
      transaction_date: "2026-08-24T14:30:00Z",
      amount_collected: "1250.50",
      transaction_type: "collection",
      normalized_outcome: "successful",
      currency: "EGP",
    },
  ]);
});

test("Task 20 normalizes refunds to positive magnitudes", () => {
  const rows = prepareTransactionImportRows(
    [
      {
        rowNumber: 7,
        customerEmail: "buyer@example.com",
        transactionDate: "2026-08-24",
        amountCollected: "-25.50",
        transactionId: "",
      },
    ],
    prepareOptions("refund", "20202020-2020-4020-8020-20202020e002"),
  );

  assert.equal(rows[0]?.transaction_id, null);
  assert.equal(rows[0]?.amount_collected, "25.50");
  assert.equal(rows[0]?.transaction_type, "refund");
  assert.equal(rows[0]?.normalized_outcome, "successful");
  assert.equal(rows[0]?.currency, "EGP");
});

test("Task 20 preserves non-zero decimals below JavaScript Number range", () => {
  const sourceRow = {
    rowNumber: 8,
    customerEmail: "tiny@example.com",
    transactionDate: "2026-08-24",
    amountCollected: "1e-324",
  };

  assert.equal(validateTransactionImportRows([sourceRow]).isValid, true);

  const collection = prepareTransactionImportRows(
    [sourceRow],
    prepareOptions("collection", "20202020-2020-4020-8020-20202020e003"),
  );
  assert.equal(collection[0]?.amount_collected, "1e-324");

  const refund = prepareTransactionImportRows(
    [{ ...sourceRow, rowNumber: 9, amountCollected: "-1e-324" }],
    prepareOptions("refund", "20202020-2020-4020-8020-20202020e004"),
  );
  assert.equal(refund[0]?.amount_collected, "1e-324");
});

test("Task 20 rejects negative collections and zero-value rows before import", () => {
  for (const amountCollected of ["-10", "0"]) {
    assert.throws(
      () =>
        prepareTransactionImportRows(
          [
            {
              rowNumber: 4,
              customerEmail: "buyer@example.com",
              transactionDate: "2026-08-24",
              amountCollected,
            },
          ],
          prepareOptions(),
        ),
      (error: unknown) =>
        error instanceof TransactionImportPreparationError && error.code === "ROW_NOT_VALIDATED",
    );
  }
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
    {
      ...prepareOptions(),
      skipFirstRow: true,
    },
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.row_number, 2);
});

test("Task 20 refuses rows that have not passed the required validation contract", () => {
  assert.throws(
    () =>
      prepareTransactionImportRows(
        [
          {
            rowNumber: 1,
            customerEmail: "not-an-email",
            transactionDate: "2026-08-24",
            amountCollected: "10",
          },
        ],
        prepareOptions(),
      ),
    (error: unknown) =>
      error instanceof TransactionImportPreparationError && error.code === "ROW_NOT_VALIDATED",
  );
});

test("Task 20 rejects emails beyond the database storage boundary during validation", () => {
  const oversizedEmail = `${"a".repeat(TRANSACTION_EMAIL_MAX_LENGTH - "@b.com".length + 1)}@b.com`;
  assert.equal(oversizedEmail.length, TRANSACTION_EMAIL_MAX_LENGTH + 1);
  assert.equal(isValidTransactionEmail(oversizedEmail), false);

  const result = validateTransactionImportRows([
    {
      rowNumber: 1,
      customerEmail: oversizedEmail,
      transactionDate: "2026-08-24",
      amountCollected: "10",
    },
  ]);

  assert.equal(result.isValid, false);
  assert.equal(result.invalidRows, 1);
  assert.equal(result.issues[0]?.code, "EMAIL_INVALID");
});

test("Task 20 rejects year zero before PostgreSQL date conversion", () => {
  assert.equal(isValidTransactionDate("0001-01-01"), true);
  assert.equal(isValidTransactionDate("0000-01-01"), false);
  assert.equal(isValidTransactionDate("0000-01-01T12:00:00Z"), false);
});

test("Task 20 validates Transaction ID length before import using database character semantics", () => {
  const exactId = "😀".repeat(TRANSACTION_ID_MAX_LENGTH);
  const oversizedId = `${exactId}😀`;

  const validRow = {
    rowNumber: 11,
    customerEmail: "buyer@example.com",
    transactionDate: "2026-08-24",
    amountCollected: "10",
    transactionId: exactId,
  };
  const validResult = validateTransactionImportRows([validRow]);
  assert.equal(validResult.isValid, true);
  assert.equal(prepareTransactionImportRows([validRow], prepareOptions())[0]?.transaction_id, exactId);

  const invalidRow = { ...validRow, rowNumber: 12, transactionId: oversizedId };
  const invalidResult = validateTransactionImportRows([invalidRow]);
  assert.equal(invalidResult.isValid, false);
  assert.equal(invalidResult.issues[0]?.code, "TRANSACTION_ID_TOO_LONG");

  assert.throws(
    () => prepareTransactionImportRows([invalidRow], prepareOptions()),
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
