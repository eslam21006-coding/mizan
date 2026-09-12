import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260912190000_customer_economics_exception_resolution.sql",
    import.meta.url,
  ),
  "utf8",
);
const hardeningMigration = await readFile(
  new URL(
    "../../supabase/migrations/20260912200000_task5_review_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
const matrixRunner = await readFile(
  new URL("../rls/run-transaction-history-completeness-matrix.mjs", import.meta.url),
  "utf8",
);

test("Task 5 manual override is exception-only, exact-pool, trusted-group, and DB-authorized", () => {
  assert.match(migration, /private\.can_manage_business\(p_business_id\)/i);
  assert.match(migration, /allocation_total <> plan_row\.authoritative_amount/i);
  assert.match(migration, /customer_acquisition_cohorts/i);
  assert.match(migration, /transaction_history_complete/i);
  assert.match(migration, /p_require_exception[^;]*allocation_exception_reason/is);
  assert.match(migration, /'manual_override'::text as allocation_provenance/i);
  assert.match(
    migration,
    /revoke all on public\.customer_economics_manual_overrides from authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.save_customer_economics_manual_override[^;]*to authenticated/i,
  );
});

test("Task 5 keeps legacy rows until exact reconciliation to an authoritative pool", () => {
  assert.match(migration, /customer_economics_legacy_reconciliations/i);
  assert.match(migration, /legacy_total <> plan_row\.authoritative_amount/i);
  assert.match(migration, /LEGACY_MANUAL_UNRECONCILED/i);
  assert.match(migration, /reconciliation\.legacy_allocation_id is null/i);
});

test("Task 5 historical edits require an explicit audited correction path", () => {
  assert.match(
    migration,
    /existing_period and target_month_start < business_current_month[^;]*explicit historical correction workflow/is,
  );
  assert.match(migration, /create or replace function public\.correct_historical_monthly_actuals/i);
  assert.match(migration, /private\.can_manage_business\(target_business_id\)/i);
  assert.match(migration, /before_snapshot := private\.monthly_actual_snapshot/i);
  assert.match(migration, /after_snapshot := private\.monthly_actual_snapshot/i);
  assert.match(migration, /insert into public\.monthly_historical_corrections/i);
  assert.match(
    migration,
    /revoke all on function private\.save_monthly_actuals_preserve_missing[^;]*from authenticated/i,
  );
});

test("Task 5 hardening makes invalid overrides recoverable and serializes historical write decisions", () => {
  assert.match(hardeningMigration, /customer_economics_manual_override_status[\s\S]*not status\.is_valid/i);
  assert.match(hardeningMigration, /require_plan_exception := false/i);
  assert.match(hardeningMigration, /copy_previous_month_expenses_unchecked/i);
  assert.match(
    hardeningMigration,
    /pg_advisory_xact_lock[\s\S]*select exists[\s\S]*existing_period and target_month_start < business_current_month/is,
  );
  assert.match(
    hardeningMigration,
    /revoke all on function private\.copy_previous_month_expenses_unchecked\(uuid, date\) from authenticated/i,
  );
});

test("Task 5 database regression matrix applies all migrations before numerical/security cases", () => {
  const migrationIndex = matrixRunner.indexOf(
    "supabase/migrations/20260912190000_customer_economics_exception_resolution.sql",
  );
  const snapshotMigrationIndex = matrixRunner.indexOf(
    "supabase/migrations/20260912193000_task5_canonical_historical_snapshots.sql",
  );
  const hardeningMigrationIndex = matrixRunner.indexOf(
    "supabase/migrations/20260912200000_task5_review_hardening.sql",
  );
  const testIndex = matrixRunner.indexOf(
    "test/business/customer-economics-exception-resolution.test.sql",
  );
  const hardeningTestIndex = matrixRunner.indexOf(
    "test/business/customer-economics-exception-resolution-hardening.test.sql",
  );

  assert.ok(migrationIndex >= 0);
  assert.ok(snapshotMigrationIndex > migrationIndex);
  assert.ok(hardeningMigrationIndex > snapshotMigrationIndex);
  assert.ok(testIndex > hardeningMigrationIndex);
  assert.ok(hardeningTestIndex > testIndex);
});