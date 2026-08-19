import assert from "node:assert/strict";
import test from "node:test";
import { storedExpenseValueForDisplay } from "../../src/lib/business/monthly.ts";
import { buildExecutionPlan } from "../rls/run-attack-matrix.mjs";

test("Task 8 preserves eight decimal places entered for a percentage before converting to decimal rate", () => {
  const files = buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/mizan_test").map(
    (execution) => execution.sqlFile,
  );
  const precisionMigration = files.indexOf(
    "supabase/migrations/20260819072000_task_8_preserve_percentage_rate_precision.sql",
  );
  const precisionTest = files.indexOf("test/business/task-8-percentage-precision.test.sql");
  const attackTest = files.indexOf("test/business/task-8-monthly-data-entry.test.sql");

  assert.ok(precisionMigration >= 0);
  assert.ok(precisionTest > precisionMigration);
  assert.ok(attackTest > precisionTest);
});

test("stored percentage rates round-trip all eight user-entered decimal places", () => {
  assert.equal(storedExpenseValueForDisplay("0.0012345678", "percentage_revenue"), "0.12345678");
  assert.equal(storedExpenseValueForDisplay("0.0312345678", "percentage_revenue"), "3.12345678");
  assert.equal(storedExpenseValueForDisplay("0.0000000001", "percentage_revenue"), "0.00000001");
});

test("stored percentage display accepts database scale without relaxing user input scale", async () => {
  const { parseOptionalDecimalInput } = await import("../../src/lib/business/monthly.ts");

  assert.deepEqual(parseOptionalDecimalInput("0.12345678"), { ok: true, value: "0.12345678" });
  assert.deepEqual(parseOptionalDecimalInput("0.123456789"), { ok: false, value: null });
  assert.equal(storedExpenseValueForDisplay("0.001234567800", "percentage_revenue"), "0.12345678");
});
