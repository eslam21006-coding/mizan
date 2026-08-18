import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExecutionPlan } from "../rls/run-attack-matrix.mjs";

const action = await readFile(
  new URL("../../src/app/(app)/businesses/new/actions.ts", import.meta.url),
  "utf8",
);
const wizard = await readFile(
  new URL("../../src/app/(app)/businesses/new/business-onboarding-wizard.tsx", import.meta.url),
  "utf8",
);

test("business creation derives ownership from authenticated context", () => {
  assert.match(action, /owner_user_id:\s*auth\.userId/);
  assert.doesNotMatch(wizard, /name=["']owner_user_id["']/);
  assert.doesNotMatch(wizard, /name=["']user_id["']/);
});

test("Task 5 database migrations and attack matrix are passed to psql execution", () => {
  const plan = buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/mizan_test");
  const executedFiles = plan.map((execution) => {
    assert.equal(execution.command, "psql");
    const fileFlagIndex = execution.args.indexOf("--file");
    assert.notEqual(fileFlagIndex, -1);
    return execution.args[fileFlagIndex + 1];
  });

  assert.deepEqual(
    executedFiles.filter((file) => file.includes("task_5") || file.includes("task-5")),
    [
      "supabase/migrations/20260818095500_task_5_business_onboarding.sql",
      "supabase/migrations/20260818095501_task_5_validate_timezone_constraint.sql",
      "test/business/task-5-business-onboarding.test.sql",
    ],
  );
});

test("implicit Enter submission advances inside handleSubmit before the final review step", () => {
  const match = wizard.match(
    /function handleSubmit\(event: FormEvent<HTMLFormElement>\) \{([\s\S]*?)\n  \}\n\n  const currencyLabel/,
  );
  assert.ok(match, "handleSubmit implementation was not found");
  const handleSubmit = match[1];

  assert.match(wizard, /onSubmit=\{handleSubmit\}/);
  assert.match(handleSubmit, /if \(step < steps\.length - 1\)/);
  assert.match(handleSubmit, /event\.preventDefault\(\)/);
  assert.match(handleSubmit, /goForward\(\)/);
});

test("Task 5 wizard does not pull Task 6, 7, or funnel data entry forward", () => {
  assert.doesNotMatch(wizard, /name=["']revenue_stream/);
  assert.doesNotMatch(wizard, /name=["']expense/);
  assert.doesNotMatch(wizard, /name=["']funnel/);
});
