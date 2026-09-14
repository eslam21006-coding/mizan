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

test("final matrix includes omitted production migration before post-batch hardening", () => {
  const importSummary = finalMatrix.indexOf(
    "supabase/migrations/20260907070000_transaction_import_completion_summary.sql",
  );
  const legacyIdReconciliation = finalMatrix.indexOf(
    "supabase/migrations/20260907201500_reconcile_legacy_transaction_ids.sql",
  );
  const customerNameMetadata = finalMatrix.indexOf(
    "supabase/migrations/20260908100000_customer_name_metadata.sql",
  );
  const postBatchHardening = finalMatrix.indexOf(
    "supabase/migrations/20260914080000_post_batch_final_security_hardening.sql",
  );

  assert.ok(importSummary >= 0);
  assert.ok(legacyIdReconciliation > importSummary);
  assert.ok(customerNameMetadata > legacyIdReconciliation);
  assert.ok(postBatchHardening > customerNameMetadata);
});

test("hardened Task 5 RPC behavior is exercised before the final global audit", () => {
  const task5Hardening = finalMatrix.indexOf(
    "supabase/migrations/20260912200000_task5_review_hardening.sql",
  );
  const postBatchHardening = finalMatrix.indexOf(
    "supabase/migrations/20260914080000_post_batch_final_security_hardening.sql",
  );
  const exceptionResolutionTest = finalMatrix.indexOf(
    "test/business/customer-economics-exception-resolution.test.sql",
  );
  const exceptionHardeningTest = finalMatrix.indexOf(
    "test/business/customer-economics-exception-resolution-hardening.test.sql",
  );
  const globalAudit = finalMatrix.indexOf("test/rls/task-39-full-security-review.test.sql");
  const completionMessage = finalMatrix.indexOf("console.log(");

  assert.ok(task5Hardening >= 0);
  assert.ok(postBatchHardening > task5Hardening);
  assert.ok(exceptionResolutionTest > postBatchHardening);
  assert.ok(exceptionHardeningTest > postBatchHardening);
  assert.ok(globalAudit > exceptionResolutionTest);
  assert.ok(globalAudit > exceptionHardeningTest);
  assert.ok(completionMessage > globalAudit);
});