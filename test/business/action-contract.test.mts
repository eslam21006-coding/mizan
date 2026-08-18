import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const action = await readFile(
  new URL("../../src/app/(app)/businesses/new/actions.ts", import.meta.url),
  "utf8",
);
const wizard = await readFile(
  new URL("../../src/app/(app)/businesses/new/business-onboarding-wizard.tsx", import.meta.url),
  "utf8",
);
const runner = await readFile(new URL("../rls/run-attack-matrix.mjs", import.meta.url), "utf8");

test("business creation derives ownership from authenticated context", () => {
  assert.match(action, /owner_user_id:\s*auth\.userId/);
  assert.doesNotMatch(wizard, /name=["']owner_user_id["']/);
  assert.doesNotMatch(wizard, /name=["']user_id["']/);
});

test("Task 5 database migration and attack matrix run in CI", () => {
  assert.match(runner, /20260818095500_task_5_business_onboarding\.sql/);
  assert.match(runner, /task-5-business-onboarding\.test\.sql/);
});

test("Task 5 wizard does not pull Task 6, 7, or funnel data entry forward", () => {
  assert.doesNotMatch(wizard, /name=["']revenue_stream/);
  assert.doesNotMatch(wizard, /name=["']expense/);
  assert.doesNotMatch(wizard, /name=["']funnel/);
});
