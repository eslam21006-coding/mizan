import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { prepareTransactionImportRows } from "../../src/lib/business/transaction-import.ts";
import {
  normalizeGatewayTransactionRows,
  validateTransactionImportRows,
  type TransactionValidationInputRow,
} from "../../src/lib/business/transaction-import-validation.ts";

const validTransaction: TransactionValidationInputRow = {
  rowNumber: 2,
  customerEmail: "buyer@example.com",
  transactionDate: "2026-09-05",
  amountCollected: "27",
  currency: "USD",
};

const detailRow: TransactionValidationInputRow = {
  rowNumber: 3,
  customerEmail: "buyer@example.com",
  transactionDate: "",
  amountCollected: "",
  currency: "",
};

test("gateway detail rows without a transaction date or amount are ignored before validation", () => {
  const result = validateTransactionImportRows([validTransaction, detailRow], {
    baseCurrency: "USD",
  });

  assert.equal(result.totalSourceRows, 2);
  assert.equal(result.checkedRows, 1);
  assert.equal(result.validRows, 1);
  assert.equal(result.invalidRows, 0);
  assert.equal(result.issueCount, 0);
  assert.equal(result.ignoredDetailRows, 1);
  assert.equal(result.isValid, true);
});

test("detail-row filtering does not hide rows that contain one transaction signal", () => {
  const result = validateTransactionImportRows(
    [
      {
        rowNumber: 4,
        customerEmail: "date-missing@example.com",
        transactionDate: "",
        amountCollected: "25",
        currency: "USD",
      },
      {
        rowNumber: 5,
        customerEmail: "amount-missing@example.com",
        transactionDate: "2026-09-05",
        amountCollected: "",
        currency: "USD",
      },
    ],
    { baseCurrency: "USD" },
  );

  assert.equal(result.ignoredDetailRows, 0);
  assert.equal(result.checkedRows, 2);
  assert.equal(result.invalidRows, 2);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["TRANSACTION_DATE_REQUIRED", "AMOUNT_REQUIRED"],
  );
});

test("detail-row filtering keeps mixed-currency transactions blocked", () => {
  const result = validateTransactionImportRows(
    [
      detailRow,
      {
        ...validTransaction,
        rowNumber: 6,
        currency: "AED",
      },
    ],
    { baseCurrency: "USD" },
  );

  assert.equal(result.ignoredDetailRows, 1);
  assert.equal(result.checkedRows, 1);
  assert.equal(result.invalidRows, 1);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["CURRENCY_MISMATCH"]);
  assert.equal(result.isValid, false);
});

test("the actual import preparation applies the same detail-row filter as validation", () => {
  let token = 0;
  const normalized = normalizeGatewayTransactionRows([validTransaction, detailRow]);
  assert.equal(normalized.rows.length, 1);
  assert.equal(normalized.ignoredDetailRows, 1);

  const prepared = prepareTransactionImportRows([validTransaction, detailRow], {
    transactionType: "collection",
    baseCurrency: "USD",
    createImportRowToken: () => `token-${++token}`,
  });

  assert.equal(prepared.length, 1);
  assert.equal(prepared[0]?.row_number, validTransaction.rowNumber);
  assert.equal(prepared[0]?.amount_collected, "27");
  assert.equal(prepared[0]?.currency, "USD");
});

test("a file containing only detail rows remains invalid because it has no transactions", () => {
  const result = validateTransactionImportRows([
    detailRow,
    { ...detailRow, rowNumber: 4, customerEmail: "another@example.com" },
  ], { baseCurrency: "USD" });

  assert.equal(result.checkedRows, 0);
  assert.equal(result.ignoredDetailRows, 2);
  assert.equal(result.isValid, false);
});

test("Arabic import review tells the user how many detail rows were ignored", async () => {
  const validatorPath = fileURLToPath(
    new URL(
      "../../src/app/(app)/businesses/[businessId]/customers/import/transaction-import-validator.tsx",
      import.meta.url,
    ),
  );
  const source = await readFile(validatorPath, "utf8");

  assert.match(source, /result\.ignoredDetailRows > 0/);
  assert.match(source, /تم تجاهل \{result\.ignoredDetailRows\} صف تفاصيل/);
  assert.match(source, /لم يُحسب كمعاملة/);
});
