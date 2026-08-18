import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExecutionPlan, sqlFiles } from "./run-attack-matrix.mjs";

const packageJson = JSON.parse(
  await readFile(new URL("../../package.json", import.meta.url), "utf8"),
);
const ciWorkflow = await readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");

test("npm test executes the database-backed RLS attack matrix", () => {
  assert.match(packageJson.scripts["test:rls"], /run-attack-matrix\.mjs/);
  assert.match(ciWorkflow, /image: postgres:17-alpine/);
  assert.match(
    ciWorkflow,
    /RLS_TEST_DATABASE_URL: postgresql:\/\/postgres:postgres@127\.0\.0\.1:5432\/mizan_test/,
  );
});

test("RLS execution plan fails closed for unsafe database URLs", () => {
  assert.throws(
    () => buildExecutionPlan("postgresql://postgres:postgres@localhost:5432/mizan_test"),
    /literal loopback address 127\.0\.0\.1/,
  );
  assert.throws(
    () => buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/postgres"),
    /database name ending in _test/,
  );
  assert.throws(
    () => buildExecutionPlan("postgresql://postgres:postgres@example.com:5432/mizan_test"),
    /literal loopback address 127\.0\.0\.1/,
  );
});

test("RLS execution plan invokes every SQL file through fail-fast psql in staged migration order", () => {
  const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/mizan_test";
  const plan = buildExecutionPlan(databaseUrl);

  assert.equal(plan.length, sqlFiles.length);
  assert.deepEqual(
    plan.map((execution) => execution.sqlFile),
    [...sqlFiles],
  );

  for (const execution of plan) {
    assert.equal(execution.command, "psql");
    assert.deepEqual(execution.args.slice(0, 5), [
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--dbname",
      databaseUrl,
    ]);
    assert.deepEqual(execution.args.slice(-2), ["--file", execution.sqlFile]);
  }

  const fixtureIndex = sqlFiles.indexOf("test/business/task-5-preexisting-business.fixture.sql");
  const addColumnIndex = sqlFiles.indexOf(
    "supabase/migrations/20260818105500_task_5_business_creation_idempotency.sql",
  );
  const backfillIndex = sqlFiles.indexOf(
    "supabase/migrations/20260818105502_task_5_backfill_creation_request_ids.sql",
  );
  const concurrentIndex = sqlFiles.indexOf(
    "supabase/migrations/20260818105505_task_5_creation_request_unique_index.sql",
  );
  const attachIndex = sqlFiles.indexOf(
    "supabase/migrations/20260818105506_task_5_attach_creation_request_unique_constraint.sql",
  );
  const backfillVerificationIndex = sqlFiles.indexOf(
    "test/business/task-5-idempotency-backfill.test.sql",
  );

  assert.ok(fixtureIndex < addColumnIndex);
  assert.ok(addColumnIndex < backfillIndex);
  assert.ok(backfillIndex < concurrentIndex);
  assert.ok(concurrentIndex < attachIndex);
  assert.ok(attachIndex < backfillVerificationIndex);
});
