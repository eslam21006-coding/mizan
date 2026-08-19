import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const actions = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/monthly/actions.ts", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/monthly/page.tsx", import.meta.url),
  "utf8",
);

test("Task 8 server actions validate input before calling the transactional monthly RPCs", () => {
  assert.match(actions, /await requireAuthContext\(\)/);
  assert.match(actions, /parseOptionalCountInput/);
  assert.match(actions, /parseOptionalDecimalInput/);
  assert.match(actions, /newCustomers\.value > payingCustomers\.value/);
  assert.match(actions, /\.rpc\("save_monthly_actuals"/);
  assert.match(actions, /\.rpc\("copy_previous_month_expenses"/);
  assert.doesNotMatch(actions, /\.from\("monthly_periods"\)\.(insert|update|upsert)/);
});

test("Task 8 page exposes the seven raw-input sections without calculated Task 9 KPIs", () => {
  for (const title of [
    "الإيراد",
    "المرتجعات",
    "العملاء",
    "الاكتساب",
    "التنفيذ وخدمة العملاء",
    "المصاريف التشغيلية العامة",
    "المصاريف المالية",
  ]) {
    assert.ok(page.includes(`title="${title}"`));
  }

  assert.doesNotMatch(page, /Real Net Profit/i);
  assert.doesNotMatch(page, /Ultimate CAC/i);
  assert.doesNotMatch(page, /Contribution Profit/i);
  assert.doesNotMatch(page, />MER</i);
  assert.doesNotMatch(page, /ROAS/i);
});

test("Task 8 page uses server-derived Admin-or-owner management access and keeps members read-only", () => {
  assert.match(page, /const canManage = auth\.role === "admin" \|\| business\.owner_user_id === auth\.userId/);
  assert.match(page, /!canManage && !dataLoadError/);
  assert.match(page, /canManage \? \(/);
});

test("Task 8 page fails closed for mutations when any monthly data dependency fails to load", () => {
  assert.match(
    page,
    /const dataLoadError = Boolean\([\s\S]*periodResult\.error[\s\S]*streamsResult\.error[\s\S]*expensesResult\.error[\s\S]*entryLoadError/,
  );
  assert.match(page, /const canEditMonth = canManage && !dataLoadError/);
  assert.match(page, /\{canEditMonth && \(/);
  assert.match(page, /\{!dataLoadError &&[\s\S]*canManage \? \(/);
});

test("Task 8 page preserves historical snapshot semantics when setup metadata changes", () => {
  assert.match(page, /entry\?\.stream_name_snapshot \?\? stream\.name/);
  assert.match(page, /entry\?\.stream_type_snapshot \?\? stream\.stream_type/);
  assert.match(page, /entry\?\.category_snapshot \?\? expense\.category/);
  assert.match(page, /entry\?\.cost_behavior_snapshot \?\? expense\.cost_behavior/);
});
