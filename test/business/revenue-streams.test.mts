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
const safeDeleteMigration = await readFile(
  new URL(
    "../../supabase/migrations/20260905163000_founder_setup_item_safe_delete.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Task 16 supports the locked Front-End, Backend, and Other revenue stream types", () => {
  assert.deepEqual([...REVENUE_STREAM_TYPES], ["front_end", "backend", "other"]);
  assert.equal(parseRevenueStreamType("front_end"), "front_end");
  assert.equal(parseRevenueStreamType("backend"), "backend");
  assert.equal(parseRevenueStreamType("other"), "other");
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

test("unused revenue streams have a guarded owner/admin delete path while history remains protected", () => {
  assert.match(action, /export async function deleteRevenueStream/);
  assert.match(action, /\.from\("revenue_streams"\)[\s\S]*\.delete\(\)/);
  assert.match(action, /error\?\.code === "23503"/);
  assert.match(page, /ConfirmSubmitButton/);
  assert.match(page, /حذف المصدر/);
  assert.match(page, /query\.status === "in-use"/);
  assert.match(safeDeleteMigration, /grant delete on public\.revenue_streams to authenticated/i);
  assert.match(safeDeleteMigration, /create policy revenue_streams_delete/i);
  assert.match(safeDeleteMigration, /private\.can_manage_business\(business_id\)/i);
});

test("read-only business members do not receive revenue stream mutation controls", () => {
  assert.match(page, /const auth = await requireAuthContext\(\)/);
  assert.match(page, /\.select\("id,name,base_currency,owner_user_id"\)/);
  assert.match(
    page,
    /const canManageRevenueStreams = auth\.role === "admin" \|\| business\.owner_user_id === auth\.userId/,
  );
  assert.match(page, /\{canManageRevenueStreams && \(/);
});

test("safe-delete migration and database attack matrix execute in CI", () => {
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
  assert.ok(
    executedFiles.includes(
      "supabase/migrations/20260905163000_founder_setup_item_safe_delete.sql",
    ),
  );
  assert.ok(executedFiles.includes("test/business/founder-setup-item-safe-delete.test.sql"));
});

test("Task 6 RLS uses read and manage business boundaries", () => {
  assert.match(migration, /alter table public\.revenue_streams enable row level security/i);
  assert.match(migration, /private\.can_read_business\(business_id\)/);
  assert.match(migration, /private\.can_manage_business\(business_id\)/);
  assert.match(migration, /before update of creation_request_id on public\.revenue_streams/i);
});
