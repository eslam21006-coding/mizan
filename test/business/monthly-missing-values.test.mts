import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExecutionPlan } from "../rls/run-attack-matrix.mjs";

const actions = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/monthly/actions.ts", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/monthly/page.tsx", import.meta.url),
  "utf8",
);
const correctionMigration = await readFile(
  new URL(
    "../../supabase/migrations/20260819083834_task_8_preserve_missing_unallocated_and_basis_validation.sql",
    import.meta.url,
  ),
  "utf8",
);
const packageJson = JSON.parse(
  await readFile(new URL("../../package.json", import.meta.url), "utf8"),
) as { engines?: { node?: string } };

test("blank unallocated monthly inputs remain null from form to page rendering", () => {
  assert.match(actions, /target_unallocated_gross:\s*unallocatedGross\.value/);
  assert.match(actions, /target_unallocated_refunds:\s*unallocatedRefunds\.value/);
  assert.doesNotMatch(actions, /target_unallocated_gross:[^\n]*\?\?\s*["']0["']/);
  assert.doesNotMatch(actions, /target_unallocated_refunds:[^\n]*\?\?\s*["']0["']/);
  assert.match(page, /asInputValue\(period\?\.unallocated_gross_cash_collected\)/);
  assert.match(page, /asInputValue\(period\?\.unallocated_refunds\)/);
  assert.doesNotMatch(page, /unallocated_gross_cash_collected\s*\?\?\s*["']0["']/);
  assert.doesNotMatch(page, /unallocated_refunds\s*\?\?\s*["']0["']/);
});

test("corrective migration preserves missing unallocated values and explicit per-customer validation", () => {
  assert.match(
    correctionMigration,
    /alter column unallocated_gross_cash_collected drop not null/i,
  );
  assert.match(correctionMigration, /alter column unallocated_refunds drop not null/i);
  assert.match(
    correctionMigration,
    /unallocated_gross_cash_collected = target_unallocated_gross/i,
  );
  assert.match(correctionMigration, /unallocated_refunds = target_unallocated_refunds/i);
  assert.match(
    correctionMigration,
    /cost_behavior_snapshot = 'per_customer'[^;]*customer_count_basis is null[^;]*22023/is,
  );
});

test("corrective migration and its database regression run before the main Task 8 matrix", () => {
  const files = buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/mizan_test").map(
    (execution) => execution.sqlFile,
  );
  const migrationIndex = files.indexOf(
    "supabase/migrations/20260819083834_task_8_preserve_missing_unallocated_and_basis_validation.sql",
  );
  const regressionIndex = files.indexOf("test/business/task-8-missing-value-validation.test.sql");
  const attackIndex = files.indexOf("test/business/task-8-monthly-data-entry.test.sql");

  assert.ok(migrationIndex >= 0);
  assert.ok(regressionIndex > migrationIndex);
  assert.ok(attackIndex > regressionIndex);
});

test("declared Node support includes the strip-types flag used by business tests", () => {
  assert.equal(packageJson.engines?.node, ">=22.6.0");
});
