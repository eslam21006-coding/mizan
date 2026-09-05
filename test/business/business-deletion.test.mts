import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isBusinessDeletionConfirmation } from "../../src/lib/business/business-deletion.ts";

const actionsSource = readFileSync(
  "src/app/(app)/settings/businesses/[businessId]/delete/actions.ts",
  "utf8",
);
const settingsSource = readFileSync("src/app/(app)/settings/page.tsx", "utf8");
const deletePageSource = readFileSync(
  "src/app/(app)/settings/businesses/[businessId]/delete/page.tsx",
  "utf8",
);
const historyGuardSource = readFileSync(
  "supabase/migrations/20260905174000_founder_business_delete_history_guard.sql",
  "utf8",
);
const confirmedDeleteSource = readFileSync(
  "supabase/migrations/20260905213500_founder_business_confirmed_cascade_delete.sql",
  "utf8",
);

test("business deletion requires the explicit Arabic or English confirmation word", () => {
  assert.equal(isBusinessDeletionConfirmation("حذف"), true);
  assert.equal(isBusinessDeletionConfirmation(" Delete "), true);
  assert.equal(isBusinessDeletionConfirmation("delete"), true);
  assert.equal(isBusinessDeletionConfirmation("DELETE"), true);
  assert.equal(isBusinessDeletionConfirmation("حذف البزنس"), false);
  assert.equal(isBusinessDeletionConfirmation("Delete business"), false);
  assert.equal(isBusinessDeletionConfirmation(""), false);
  assert.equal(isBusinessDeletionConfirmation(null), false);
});

test("business deletion is owner/admin gated in UI, server action, and database RPC", () => {
  assert.match(settingsSource, /auth\.role === "admin" \|\| business\.owner_user_id === auth\.userId/);
  assert.match(actionsSource, /auth\.role === "admin" \|\| business\.owner_user_id === auth\.userId/);
  assert.match(actionsSource, /redirect\("\/access-denied"\)/);
  assert.match(deletePageSource, /redirect\("\/access-denied"\)/);
  assert.match(confirmedDeleteSource, /private\.can_manage_business\(p_business_id\)/);
});

test("confirmed deletion removes the whole business through one database RPC", () => {
  assert.match(actionsSource, /\.rpc\("delete_business_confirmed"/);
  assert.match(confirmedDeleteSource, /create or replace function public\.delete_business_confirmed/i);
  assert.match(confirmedDeleteSource, /delete from public\.monthly_periods/i);
  assert.match(confirmedDeleteSource, /delete from public\.funnel_monthly_periods/i);
  assert.match(confirmedDeleteSource, /delete from public\.customer_transactions/i);
  assert.match(confirmedDeleteSource, /delete from public\.customer_cohort_cost_allocations/i);
  assert.match(confirmedDeleteSource, /delete from public\.simulator_scenarios/i);
  assert.match(confirmedDeleteSource, /delete from public\.businesses/i);
  assert.doesNotMatch(actionsSource, /protected-data/);
  assert.doesNotMatch(deletePageSource, /protected-data/);
});

test("direct table deletion remains guarded so only the confirmed workflow can erase history", () => {
  assert.match(historyGuardSource, /before delete on public\.businesses/i);
  assert.match(historyGuardSource, /from public\.monthly_periods/i);
  assert.match(historyGuardSource, /errcode = '23503'/i);
});

test("settings exposes deletion as a separate danger-zone workflow with irreversible wording", () => {
  assert.match(settingsSource, /منطقة خطرة/);
  assert.match(settingsSource, /\/settings\/businesses\/\$\{business\.id\}\/delete/);
  assert.match(deletePageSource, /«حذف» أو «Delete»/);
  assert.match(deletePageSource, /سيتم حذف كل بيانات البزنس/);
});
