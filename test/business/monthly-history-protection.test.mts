import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExecutionPlan } from "../rls/run-attack-matrix.mjs";

const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260819073000_task_8_protect_historical_setup_links.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Task 8 setup-item foreign keys no longer cascade-delete monthly history", () => {
  assert.doesNotMatch(
    migration,
    /references public\.revenue_streams\(business_id, id\)\s+on delete cascade/i,
  );
  assert.doesNotMatch(
    migration,
    /references public\.expense_items\(business_id, id\)\s+on delete cascade/i,
  );
});

test("Task 8 history-delete protection runs before the main Task 8 attack matrix", () => {
  const files = buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/mizan_test").map(
    (execution) => execution.sqlFile,
  );
  const migrationIndex = files.indexOf(
    "supabase/migrations/20260819073000_task_8_protect_historical_setup_links.sql",
  );
  const historyTestIndex = files.indexOf(
    "test/business/task-8-history-delete-protection.test.sql",
  );
  const attackIndex = files.indexOf("test/business/task-8-monthly-data-entry.test.sql");

  assert.ok(migrationIndex >= 0);
  assert.ok(historyTestIndex > migrationIndex);
  assert.ok(attackIndex > historyTestIndex);
});
