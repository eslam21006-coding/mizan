import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTransactionColumnChoices,
  EMPTY_TRANSACTION_COLUMN_MAPPING,
  inspectTransactionColumnMapping,
  setTransactionFieldColumn,
  TRANSACTION_NATIVE_MAPPING_OPTION_LIMIT,
} from "../../src/lib/business/transaction-column-mapping.ts";
import { transactionColumnLabel } from "../../src/lib/business/transaction-columns.ts";

test("Task 18 mapping starts incomplete with all required fields missing", () => {
  const state = inspectTransactionColumnMapping(EMPTY_TRANSACTION_COLUMN_MAPPING);

  assert.equal(state.isComplete, false);
  assert.equal(state.hasDuplicateColumns, false);
  assert.deepEqual(state.missingFields, ["customerEmail", "transactionDate", "amountCollected"]);
});

test("Task 18 mapping is complete only when all required fields use unique columns", () => {
  const mapping = {
    customerEmail: 0,
    transactionDate: 2,
    amountCollected: 4,
  } as const;

  const state = inspectTransactionColumnMapping(mapping);
  assert.equal(state.isComplete, true);
  assert.equal(state.hasDuplicateColumns, false);
  assert.deepEqual(state.missingFields, []);
});

test("Task 18 rejects duplicate column assignments", () => {
  const state = inspectTransactionColumnMapping({
    customerEmail: 1,
    transactionDate: 1,
    amountCollected: 2,
  });

  assert.equal(state.isComplete, false);
  assert.equal(state.hasDuplicateColumns, true);
});

test("Task 18 updates one field without mutating the original mapping", () => {
  const original = EMPTY_TRANSACTION_COLUMN_MAPPING;
  const updated = setTransactionFieldColumn(original, "customerEmail", 3);

  assert.equal(original.customerEmail, null);
  assert.equal(updated.customerEmail, 3);
  assert.equal(updated.transactionDate, null);
});

test("Task 18 rejects invalid negative column indexes", () => {
  assert.throws(
    () => setTransactionFieldColumn(EMPTY_TRANSACTION_COLUMN_MAPPING, "customerEmail", -1),
    RangeError,
  );
});

test("Task 18 uses one shared Excel-style column label formatter", () => {
  assert.equal(transactionColumnLabel(0), "A");
  assert.equal(transactionColumnLabel(19), "T");
  assert.equal(transactionColumnLabel(22), "W");
  assert.equal(transactionColumnLabel(25), "Z");
  assert.equal(transactionColumnLabel(26), "AA");
});

test("Task 18 offers every ordinary detected column while keeping samples preview-bounded", () => {
  const previewRow = Array.from({ length: 20 }, (_, index) => `sample-${index + 1}`);
  const choices = buildTransactionColumnChoices({
    totalColumns: 23,
    previewRows: [previewRow],
    sampleColumnLimit: 20,
  });

  assert.equal(choices.length, 23);
  assert.deepEqual(choices[19], { column: 19, label: "T", sample: "sample-20" });
  assert.deepEqual(choices[20], { column: 20, label: "U", sample: "" });
  assert.deepEqual(choices[22], { column: 22, label: "W", sample: "" });
});

test("Task 18 bounds native choices for extremely wide files", () => {
  const choices = buildTransactionColumnChoices({
    totalColumns: 50_000,
    previewRows: [["email", "date", "amount"]],
    sampleColumnLimit: 20,
  });

  assert.equal(choices.length, TRANSACTION_NATIVE_MAPPING_OPTION_LIMIT);
  assert.equal(choices.at(-1)?.column, TRANSACTION_NATIVE_MAPPING_OPTION_LIMIT - 1);
});

test("Task 18 mapping model accepts a valid far-right column for direct wide-file entry", () => {
  const updated = setTransactionFieldColumn(EMPTY_TRANSACTION_COLUMN_MAPPING, "amountCollected", 49_999);
  assert.equal(updated.amountCollected, 49_999);
  assert.equal(transactionColumnLabel(updated.amountCollected as number), "BUYB");
});

test("Task 20 keeps Transaction ID optional while using it in duplicate-column checks when mapped", () => {
  const withoutId = inspectTransactionColumnMapping({
    customerEmail: 0,
    transactionDate: 1,
    amountCollected: 2,
    transactionId: null,
  });
  assert.equal(withoutId.isComplete, true);

  const withId = inspectTransactionColumnMapping({
    customerEmail: 0,
    transactionDate: 1,
    amountCollected: 2,
    transactionId: 3,
  });
  assert.equal(withId.isComplete, true);
  assert.equal(withId.hasDuplicateColumns, false);

  const conflictingId = inspectTransactionColumnMapping({
    customerEmail: 0,
    transactionDate: 1,
    amountCollected: 2,
    transactionId: 2,
  });
  assert.equal(conflictingId.isComplete, false);
  assert.equal(conflictingId.hasDuplicateColumns, true);
});
