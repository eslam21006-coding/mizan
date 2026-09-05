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
const migrationSource = readFileSync(
  "supabase/migrations/20260905174000_founder_business_delete_history_guard.sql",
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

test("business deletion is owner/admin gated in both UI and server action", () => {
  assert.match(settingsSource, /auth\.role === "admin" \|\| business\.owner_user_id === auth\.userId/);
  assert.match(actionsSource, /auth\.role === "admin" \|\| business\.owner_user_id === auth\.userId/);
  assert.match(actionsSource, /redirect\("\/access-denied"\)/);
  assert.match(deletePageSource, /redirect\("\/access-denied"\)/);
});

test("monthly history is protected at the database boundary", () => {
  assert.match(migrationSource, /before delete on public\.businesses/i);
  assert.match(migrationSource, /from public\.monthly_periods/i);
  assert.match(migrationSource, /errcode = '23503'/i);
  assert.match(actionsSource, /error\?\.code === "23503"/);
});

test("settings exposes deletion as a separate danger-zone workflow", () => {
  assert.match(settingsSource, /منطقة خطرة/);
  assert.match(settingsSource, /\/settings\/businesses\/\$\{business\.id\}\/delete/);
  assert.match(deletePageSource, /«حذف» أو «Delete»/);
});
