import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FUNNEL_TYPES,
  normalizeFunnelName,
  parseFunnelActiveState,
  parseFunnelResourceId,
  parseFunnelType,
} from "../../src/lib/business/funnels.ts";
import { buildExecutionPlan } from "../rls/run-attack-matrix.mjs";

const action = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/funnels/actions.ts", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/funnels/page.tsx", import.meta.url),
  "utf8",
);
const businessesPage = await readFile(
  new URL("../../src/app/(app)/businesses/page.tsx", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260821001500_task_14_funnel_management.sql",
    import.meta.url,
  ),
  "utf8",
);

test("Task 14 supports the agreed funnel management types", () => {
  assert.deepEqual([...FUNNEL_TYPES], [
    "webinar",
    "lead_gen",
    "low_ticket",
    "organic",
    "referral",
    "event",
  ]);
  for (const type of FUNNEL_TYPES) {
    assert.equal(parseFunnelType(type), type);
  }
  assert.equal(parseFunnelType("sales_call"), null);
  assert.equal(parseFunnelType(""), null);
});

test("funnel names normalize whitespace and enforce the 120-character boundary", () => {
  assert.equal(normalizeFunnelName("  ويبينار   البرنامج  "), "ويبينار البرنامج");
  assert.equal(normalizeFunnelName(""), null);
  assert.equal(normalizeFunnelName("x".repeat(120)), "x".repeat(120));
  assert.equal(normalizeFunnelName("x".repeat(121)), null);
});

test("funnel resource IDs and active state are parsed explicitly", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(parseFunnelResourceId(id.toUpperCase()), id);
  assert.equal(parseFunnelResourceId("not-an-id"), null);
  assert.equal(parseFunnelActiveState("on"), true);
  assert.equal(parseFunnelActiveState("true"), true);
  assert.equal(parseFunnelActiveState(null), false);
});

test("Task 14 stores structure only and does not add funnel financial inputs", () => {
  for (const forbiddenColumn of [
    "ad_spend",
    "leads",
    "booked_calls",
    "showed_calls",
    "qualified_calls",
    "sales",
    "new_customers",
    "cash_collected",
    "attributed_revenue",
  ]) {
    assert.doesNotMatch(migration, new RegExp(`\\b${forbiddenColumn}\\b`, "i"));
  }
  assert.doesNotMatch(action, /ad_spend|leads|booked_calls|showed_calls|qualified_calls|attributed_revenue/i);
});

test("funnel writes require authentication and never accept an owner or user ID", () => {
  assert.match(action, /await requireAuthContext\(\)/);
  assert.doesNotMatch(page, /name=["']owner_user_id["']/);
  assert.doesNotMatch(page, /name=["']user_id["']/);
  assert.match(action, /\.eq\("business_id", businessId\)/);
});

test("funnel creation is database-idempotent and identity is immutable", () => {
  assert.match(page, /name="creation_request_id" value=\{randomUUID\(\)\}/);
  assert.match(action, /creation_request_id:\s*creationRequestId/);
  assert.match(action, /!error \|\| error\.code === "23505"/);
  assert.match(migration, /old\.creation_request_id is distinct from new\.creation_request_id/i);
  assert.match(migration, /old\.business_id is distinct from new\.business_id/i);
});

test("Task 14 has no authenticated hard-delete path", () => {
  assert.doesNotMatch(action, /\.delete\(\)/);
  assert.match(migration, /grant select, insert, update on public\.funnels to authenticated/i);
  assert.doesNotMatch(migration, /grant[^;]*delete[^;]*funnels[^;]*authenticated/i);
  assert.doesNotMatch(migration, /create policy funnels_delete/i);
});

test("funnel management is reachable from each business and explains optionality", () => {
  assert.match(businessesPage, /\/funnels/);
  assert.match(businessesPage, /إدارة الفانلز/);
  assert.match(page, /الفانلز اختيارية/);
  assert.match(page, /أرقام البزنس الأساسية تظل مستقلة/);
});

test("Task 14 migration and attack matrix execute in database-backed CI", () => {
  const plan = buildExecutionPlan("postgresql://postgres:postgres@127.0.0.1:5432/mizan_test");
  const executedFiles = plan.map((execution) => {
    const fileFlagIndex = execution.args.indexOf("--file");
    assert.notEqual(fileFlagIndex, -1);
    return execution.args[fileFlagIndex + 1];
  });

  assert.ok(
    executedFiles.includes("supabase/migrations/20260821001500_task_14_funnel_management.sql"),
  );
  assert.ok(executedFiles.includes("test/business/task-14-funnel-management.test.sql"));
});

test("Task 14 RLS uses existing read/manage business boundaries", () => {
  assert.match(migration, /alter table public\.funnels enable row level security/i);
  assert.match(migration, /private\.can_read_business\(business_id\)/);
  assert.match(migration, /private\.can_manage_business\(business_id\)/);
  assert.match(migration, /before update on public\.funnels/i);
});
