import assert from "node:assert/strict";
import test from "node:test";
import { autoMapTransactionHeaderRow } from "../../src/lib/business/transaction-column-mapping.ts";
import {
  normalizeGatewayTransactionRows,
  normalizeTransactionDateTimeForImport,
  parseTransactionTime,
  validateTransactionImportRows,
} from "../../src/lib/business/transaction-import-validation.ts";
import { prepareTransactionImportRows } from "../../src/lib/business/transaction-import.ts";

test("founder gateway headers map Date Time and Timezone as three separate columns", () => {
  const header = Array.from({ length: 30 }, (_, index) => `Column ${index + 1}`);
  header[0] = "Internal transaction id";
  header[4] = "Customer email";
  header[7] = "Currency";
  header[15] = "Total amount paid";
  header[27] = "Transaction date";
  header[28] = "Transaction time";
  header[29] = "Timezone";

  const result = autoMapTransactionHeaderRow(header);
  assert.equal(result.detected, true);
  assert.deepEqual(result.ambiguousFields, []);
  assert.equal(result.mapping.transactionId, 0);
  assert.equal(result.mapping.customerEmail, 4);
  assert.equal(result.mapping.currency, 7);
  assert.equal(result.mapping.amountCollected, 15);
  assert.equal(result.mapping.transactionDate, 27);
  assert.equal(result.mapping.transactionTime, 28);
  assert.equal(result.mapping.timezone, 29);
});

test("28-Aug-26 + 5:34 PM + Africa/Cairo becomes one unambiguous UTC timestamp", () => {
  assert.equal(
    normalizeTransactionDateTimeForImport("28-Aug-26", "5:34 PM", "Africa/Cairo"),
    "2026-08-28T14:34:00.000Z",
  );
  assert.deepEqual(parseTransactionTime("5:34 PM"), { hour: 17, minute: 34, second: 0 });
  assert.deepEqual(parseTransactionTime("17:34:09"), { hour: 17, minute: 34, second: 9 });
});

test("date-only imports remain supported when separate time columns are absent", () => {
  assert.equal(normalizeTransactionDateTimeForImport("28-Aug-26"), "2026-08-28");
});

test("invalid or incomplete temporal data is rejected instead of guessed", () => {
  assert.equal(normalizeTransactionDateTimeForImport("28-Aug-26", "25:34", "Africa/Cairo"), null);
  assert.equal(normalizeTransactionDateTimeForImport("28-Aug-26", "5:34 PM", "Not/A_Zone"), null);
  assert.equal(normalizeTransactionDateTimeForImport("28-Aug-26", "5:34 PM", ""), null);

  const result = validateTransactionImportRows(
    [
      {
        rowNumber: 1,
        customerEmail: "buyer@example.test",
        transactionDate: "28-Aug-26",
        transactionTime: "5:34 PM",
        timezone: "",
        amountCollected: "29",
      },
    ],
    { baseCurrency: "USD" },
  );
  assert.equal(result.isValid, false);
  assert.equal(result.issues.some((issue) => issue.code === "TIMEZONE_REQUIRED"), true);
});

test("gateway line-item rows share temporal data and still collapse by Transaction ID", () => {
  const normalized = normalizeGatewayTransactionRows([
    {
      rowNumber: 2,
      customerEmail: "buyer@example.test",
      transactionDate: "28-Aug-26",
      transactionTime: "5:34 PM",
      timezone: "Africa/Cairo",
      amountCollected: "29",
      transactionId: "tx-1",
      currency: "USD",
    },
    {
      rowNumber: 3,
      customerEmail: "",
      transactionDate: "",
      transactionTime: "",
      timezone: "",
      amountCollected: "",
      transactionId: "tx-1",
      currency: "",
    },
  ]);

  assert.equal(normalized.rows.length, 1);
  assert.equal(normalized.collapsedSourceRows, 1);
  assert.equal(normalized.rows[0]?.transactionDate, "2026-08-28T14:34:00.000Z");
});

test("actual import preparation uses the same combined timestamp as preview validation", () => {
  const sourceRows = [
    {
      rowNumber: 2,
      customerEmail: "BUYER@example.test ",
      transactionDate: "28-Aug-26",
      transactionTime: "5:34 PM",
      timezone: "Africa/Cairo",
      amountCollected: "29.00",
      transactionId: "gateway-123",
      currency: "USD",
    },
  ];

  assert.equal(validateTransactionImportRows(sourceRows, { baseCurrency: "USD" }).isValid, true);
  const prepared = prepareTransactionImportRows(sourceRows, {
    transactionType: "collection",
    baseCurrency: "USD",
    createImportRowToken: () => "retry-token-1",
  });

  assert.equal(prepared.length, 1);
  assert.equal(prepared[0]?.transaction_date, "2026-08-28T14:34:00.000Z");
  assert.equal(prepared[0]?.customer_email, "buyer@example.test");
});
