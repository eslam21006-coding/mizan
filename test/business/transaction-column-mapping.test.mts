import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_TRANSACTION_COLUMN_MAPPING,
  inspectTransactionColumnMapping,
  setTransactionFieldColumn,
} from "../../src/lib/business/transaction-column-mapping.ts";

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
