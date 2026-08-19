import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExecutionPlan } from "../rls/run-attack-matrix.mjs";

const hardeningMigration = await readFile(
  new URL(
    "../../supabase/migrations/20260819071000_task_8_harden_monthly_rpc_boundary.sql",
    import.meta.url,
  ),
  "utf8",
);

test("public monthly RPCs are invoker wrappers while privileged workers live outside the exposed schema", () => {
  assert.match(hardeningMigration, /set schema private/i);
  assert.match(hardeningMigration, /create function public\.save_monthly_actuals[^;]*security invoker/i);
  assert.match(
    hardeningMigration,
    /create function public\.copy_previous_month_expenses[^;]*security invoker/i,
  );
  assert.match(hardeningMigration, /select private\.save_monthly_actuals/i);
  assert.match(hardeningMigration, /from private\.copy_previous_month_expenses/i);
});

test("monthly composite foreign keys have dedicated covering indexes", () => {
  assert.match(
    hardeningMigration,
    /monthly_revenue_entries_business_stream_idx[^;]*\(business_id, revenue_stream_id\)/i,
  );
  assert.match(
    hardeningMigration,
    /monthly_expense_entries_business_expense_idx[^;]*\(business_id, expense_item_id\)/i,
  );
});

test("Task 8 hardening runs before the Task 8 database attack matrix", () => {
  const files = buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/mizan_test").map(
    (execution) => execution.sqlFile,
  );
  const baseIndex = files.indexOf("supabase/migrations/20260819070000_task_8_monthly_data_entry.sql");
  const hardeningIndex = files.indexOf(
    "supabase/migrations/20260819071000_task_8_harden_monthly_rpc_boundary.sql",
  );
  const attackIndex = files.indexOf("test/business/task-8-monthly-data-entry.test.sql");

  assert.ok(baseIndex >= 0);
  assert.ok(hardeningIndex > baseIndex);
  assert.ok(attackIndex > hardeningIndex);
});
