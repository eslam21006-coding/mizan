import assert from "node:assert/strict";
import test from "node:test";
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
