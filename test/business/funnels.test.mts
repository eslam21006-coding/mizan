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

const action = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/funnels/actions.ts", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/funnels/page.tsx", import.meta.url),
  "utf8",
);
const funnelsOverviewPage = await readFile(
  new URL("../../src/app/(app)/funnels/page.tsx", import.meta.url),
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
const hardeningMigration = await readFile(
  new URL(
    "../../supabase/migrations/20260821013000_task_14_protect_funnel_creation_identity.sql",
    import.meta.url,
  ),
  "utf8",
);
const retentionMigration = await readFile(
  new URL(
    "../../supabase/migrations/20260821110500_task_14_restrict_funnel_business_delete.sql",
    import.meta.url,
  ),
  "utf8",
);
const rlsRunner = await readFile(new URL("../rls/run-attack-matrix.mjs", import.meta.url), "utf8");

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

test("funnel names accept only strings, normalize whitespace, and enforce 120 characters", () => {
  assert.equal(normalizeFunnelName({}), null);
  assert.equal(normalizeFunnelName("  ويبينار   البرنامج  "), "ويبينار البرنامج");
  assert.equal(normalizeFunnelName(""), null);
  assert.equal(normalizeFunnelName("x".repeat(120)), "x".repeat(120));
  assert.equal(normalizeFunnelName("x".repeat(121)), null);
  assert.equal(normalizeFunnelName("ن".repeat(120)), "ن".repeat(120));
  assert.equal(normalizeFunnelName("ن".repeat(121)), null);
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

test("funnel creation is database-idempotent and historical identity is immutable", () => {
  assert.match(page, /name="creation_request_id"/);
  assert.match(page, /randomUUID\(\)/);
  assert.match(action, /creation_request_id:\s*creationRequestId/);
  assert.match(action, /!error \|\| error\.code === "23505"/);
  assert.match(migration, /old\.id is distinct from new\.id/i);
  assert.match(migration, /old\.created_at is distinct from new\.created_at/i);
  assert.match(migration, /old\.creation_request_id is distinct from new\.creation_request_id/i);
  assert.match(migration, /old\.business_id is distinct from new\.business_id/i);
  assert.match(hardeningMigration, /old\.id is distinct from new\.id/i);
  assert.match(hardeningMigration, /old\.created_at is distinct from new\.created_at/i);
});

test("funnel history cannot be cascade-deleted through its business", () => {
  assert.match(migration, /references public\.businesses\(id\) on delete restrict/i);
  assert.doesNotMatch(migration, /references public\.businesses\(id\) on delete cascade/i);
  assert.match(retentionMigration, /foreign key \(business_id\)/i);
  assert.match(retentionMigration, /references public\.businesses\(id\)/i);
  assert.match(retentionMigration, /on delete restrict/i);
});

test("Task 14 has no authenticated hard-delete path", () => {
  assert.doesNotMatch(action, /\.delete\(\)/);
  assert.match(migration, /grant select, insert, update on public\.funnels to authenticated/i);
  assert.doesNotMatch(migration, /grant[^;]*delete[^;]*funnels[^;]*authenticated/i);
  assert.doesNotMatch(migration, /create policy funnels_delete/i);
});

test("funnel management is reachable from the main funnel route and each business", () => {
  assert.doesNotMatch(funnelsOverviewPage, /EmptyModule/);
  assert.match(funnelsOverviewPage, /\/businesses\/\$\{business\.id\}\/funnels/);
  assert.match(funnelsOverviewPage, /الفانلز طبقة تحليل اختيارية/);
  assert.match(businessesPage, /\/funnels/);
  assert.match(businessesPage, /إدارة الفانلز/);
  assert.match(page, /الفانلز اختيارية/);
  assert.match(page, /أرقام البزنس الأساسية تظل مستقلة/);
});

test("Task 14 migrations and attack matrix are wired into database-backed CI", () => {
  assert.match(
    rlsRunner,
    /supabase\/migrations\/20260821001500_task_14_funnel_management\.sql/,
  );
  assert.match(
    rlsRunner,
    /supabase\/migrations\/20260821013000_task_14_protect_funnel_creation_identity\.sql/,
  );
  assert.match(
    rlsRunner,
    /supabase\/migrations\/20260821110500_task_14_restrict_funnel_business_delete\.sql/,
  );
  assert.match(rlsRunner, /test\/business\/task-14-funnel-management\.test\.sql/);
  assert.match(rlsRunner, /test\/business\/task-14-funnel-retention\.test\.sql/);
});

test("Task 14 RLS uses existing read/manage business boundaries", () => {
  assert.match(migration, /alter table public\.funnels enable row level security/i);
  assert.match(migration, /private\.can_read_business\(business_id\)/);
  assert.match(migration, /private\.can_manage_business\(business_id\)/);
  assert.match(migration, /before update on public\.funnels/i);
});
