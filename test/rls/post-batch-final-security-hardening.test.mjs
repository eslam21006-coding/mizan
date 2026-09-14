import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260914080000_post_batch_final_security_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const finalMatrix = await readFile(
  new URL("./run-transaction-history-completeness-matrix.mjs", import.meta.url),
  "utf8",
);

test("post-batch migration re-hardens every public/private SECURITY DEFINER routine", () => {
  assert.match(migration, /namespace\.nspname in \('public', 'private'\)/);
  assert.match(migration, /procedure\.prosecdef/);
  assert.match(
    migration,
    /alter function %I\.%I\(%s\) set search_path = pg_catalog, pg_temp/,
  );
  assert.match(
    migration,
    /alter procedure %I\.%I\(%s\) set search_path = pg_catalog, pg_temp/,
  );
});

test("global security audit runs after the final Customer Economics migrations", () => {
  const task5Hardening = finalMatrix.indexOf(
    "supabase/migrations/20260912200000_task5_review_hardening.sql",
  );
  const postBatchHardening = finalMatrix.indexOf(
    "supabase/migrations/20260914080000_post_batch_final_security_hardening.sql",
  );
  const globalAudit = finalMatrix.indexOf("test/rls/task-39-full-security-review.test.sql");
  const completionMessage = finalMatrix.indexOf("console.log(");

  assert.ok(task5Hardening >= 0);
  assert.ok(postBatchHardening > task5Hardening);
  assert.ok(globalAudit > postBatchHardening);
  assert.ok(completionMessage > globalAudit);
});
