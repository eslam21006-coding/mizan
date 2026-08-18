import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../../package.json", import.meta.url), "utf8"),
);
const ciWorkflow = await readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
const runner = await readFile(new URL("./run-attack-matrix.mjs", import.meta.url), "utf8");

test("npm test executes the database-backed RLS attack matrix", () => {
  assert.match(packageJson.scripts["test:rls"], /run-attack-matrix\.mjs/);
  assert.match(ciWorkflow, /image: postgres:17-alpine/);
  assert.match(
    ciWorkflow,
    /RLS_TEST_DATABASE_URL: postgresql:\/\/postgres:postgres@127\.0\.0\.1:5432\/mizan_test/,
  );
});

test("RLS runner fails closed and executes Task 4 plus Task 5 database tests", () => {
  assert.match(runner, /new Set\(\["127\.0\.0\.1"\]\)/);
  assert.doesNotMatch(runner, /"localhost"/);
  assert.match(runner, /databaseName\.endsWith\("_test"\)/);
  assert.match(runner, /ON_ERROR_STOP=1/);
  assert.match(runner, /20260818061945_task_4_business_ownership_rls\.sql/);
  assert.match(runner, /20260818095500_task_5_business_onboarding\.sql/);
  assert.match(runner, /task-4-business-ownership\.test\.sql/);
  assert.match(runner, /task-5-business-onboarding\.test\.sql/);
});
