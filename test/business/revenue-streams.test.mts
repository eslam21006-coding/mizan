import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  REVENUE_STREAM_TYPES,
  normalizeRevenueStreamName,
  parseActiveState,
  parseResourceId,
  parseRevenueStreamType,
} from "../../src/lib/business/revenue-streams.ts";
import { buildExecutionPlan } from "../rls/run-attack-matrix.mjs";

const action = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/revenue-streams/actions.ts",
    import.meta.url,
  ),
  "utf8",
);
const page = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/revenue-streams/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260818153600_task_6_revenue_stream_management.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Task 6 supports exactly Front-End and Backend revenue streams", () => {
  assert.deepEqual([...REVENUE_STREAM_TYPES], ["front_end", "backend"]);
  assert.equal(parseRevenueStreamType("front_end"), "front_end");
  assert.equal(parseRevenueStreamType("backend"), "backend");
  assert.equal(parseRevenueStreamType("upsell"), null);
});

test("revenue stream names normalize whitespace and enforce length", () => {
  assert.equal(normalizeRevenueStreamName("  البرنامج   الأساسي  "), "البرنامج الأساسي");
  assert.equal(normalizeRevenueStreamName(""), null);
  assert.equal(normalizeRevenueStreamName("x".repeat(121)), null);
});

test("Task 6 resource IDs and active state are parsed explicitly", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(parseResourceId(id.toUpperCase()), id);
  assert.equal(parseResourceId("not-an-id"), null);
  assert.equal(parseActiveState("on"), true);
  assert.equal(parseActiveState("true"), true);
  assert.equal(parseActiveState(null), false);
});

test("revenue stream writes rely on authenticated context and never accept an owner ID", () => {
  assert.match(action, /await requireAuthContext\(\)/);
  assert.doesNotMatch(page, /name=["']owner_user_id["']/);
  assert.doesNotMatch(page, /name=["']user_id["']/);
  assert.match(action, /\.eq\("business_id", businessId\)/);
});

test("revenue stream creation is database-idempotent", () => {
  assert.match(page, /name="creation_request_id" value=\{randomUUID\(\)\}/);
  assert.match(action, /creation_request_id:\s*creationRequestId/);
  assert.match(action, /!error \|\| error\.code === "23505"/);
  assert.doesNotMatch(action, /existingStream/);
});

test("Task 6 intentionally has no authenticated hard-delete path", () => {
  assert.doesNotMatch(action, /\.delete\(\)/);
  assert.match(migration, /grant select, insert, update on public\.revenue_streams to authenticated/i);
  assert.doesNotMatch(migration, /grant[^;]*delete[^;]*revenue_streams[^;]*authenticated/i);
  assert.doesNotMatch(migration, /create policy revenue_streams_delete/i);
});

test("Task 6 migration and live attack matrix execute in database-backed CI", () => {
  const plan = buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/mizan_test");
  const executedFiles = plan.map((execution) => {
    const fileFlagIndex = execution.args.indexOf("--file");
    assert.notEqual(fileFlagIndex, -1);
    return execution.args[fileFlagIndex + 1];
  });

  assert.ok(
    executedFiles.includes(
      "supabase/migrations/20260818153600_task_6_revenue_stream_management.sql",
    ),
  );
  assert.ok(executedFiles.includes("test/business/task-6-revenue-stream-management.test.sql"));
});

test("Task 6 RLS uses read and manage business boundaries", () => {
  assert.match(migration, /alter table public\.revenue_streams enable row level security/i);
  assert.match(migration, /private\.can_read_business\(business_id\)/);
  assert.match(migration, /private\.can_manage_business\(business_id\)/);
  assert.match(migration, /before update of creation_request_id on public\.revenue_streams/i);
});
