import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExecutionPlan } from "../rls/run-attack-matrix.mjs";

const protectionMigration = await readFile(
  new URL(
    "../../supabase/migrations/20260819073000_task_8_protect_historical_setup_links.sql",
    import.meta.url,
  ),
  "utf8",
);
const deferralMigration = await readFile(
  new URL(
    "../../supabase/migrations/20260819074000_task_8_defer_history_link_checks.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Task 8 setup-item links protect monthly history without blocking whole-business deletion", () => {
  assert.doesNotMatch(
    protectionMigration,
    /references public\.revenue_streams\(business_id, id\)\s+on delete cascade/i,
  );
  assert.doesNotMatch(
    protectionMigration,
    /references public\.expense_items\(business_id, id\)\s+on delete cascade/i,
  );
  assert.match(
    deferralMigration,
    /monthly_revenue_entries_stream_business_fk[\s\S]*deferrable initially deferred/i,
  );
  assert.match(
    deferralMigration,
    /monthly_expense_entries_expense_business_fk[\s\S]*deferrable initially deferred/i,
  );
});

test("Task 8 history protection migrations run before their database test and main attack matrix", () => {
  const files = buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/mizan_test").map(
    (execution) => execution.sqlFile,
  );
  const protectionIndex = files.indexOf(
    "supabase/migrations/20260819073000_task_8_protect_historical_setup_links.sql",
  );
  const deferralIndex = files.indexOf(
    "supabase/migrations/20260819074000_task_8_defer_history_link_checks.sql",
  );
  const historyTestIndex = files.indexOf(
    "test/business/task-8-history-delete-protection.test.sql",
  );
  const attackIndex = files.indexOf("test/business/task-8-monthly-data-entry.test.sql");

  assert.ok(protectionIndex >= 0);
  assert.ok(deferralIndex > protectionIndex);
  assert.ok(historyTestIndex > deferralIndex);
  assert.ok(attackIndex > historyTestIndex);
});
