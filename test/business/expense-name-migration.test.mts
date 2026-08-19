import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExecutionPlan } from "../rls/run-attack-matrix.mjs";

const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260819062811_task_7_preserve_trimmed_expense_name_length.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Task 7 final expense-name constraint keeps trimmed length and rejects whitespace-only names", () => {
  assert.match(migration, /char_length\(btrim\(name\)\) between 1 and 120/i);
  assert.ok(migration.includes("name ~ '[^[:space:]]'"));
});

test("Task 7 final expense-name migration and compatibility test run before the main attack matrix", () => {
  const plan = buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/mizan_test");
  const files = plan.map((execution) => execution.sqlFile);
  const migrationIndex = files.indexOf(
    "supabase/migrations/20260819062811_task_7_preserve_trimmed_expense_name_length.sql",
  );
  const compatibilityIndex = files.indexOf(
    "test/business/task-7-expense-name-compatibility.test.sql",
  );
  const attackIndex = files.indexOf("test/business/task-7-expense-structure.test.sql");

  assert.ok(migrationIndex >= 0);
  assert.ok(compatibilityIndex > migrationIndex);
  assert.ok(attackIndex > compatibilityIndex);
});
