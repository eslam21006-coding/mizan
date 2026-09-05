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
const entryForm = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/monthly/monthly-entry-form.tsx",
    import.meta.url,
  ),
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

test("monthly entry groups raw inputs into three compact sections without calculated dashboard KPIs", () => {
  for (const title of ["الإيرادات والمرتجعات", "العملاء", "المصاريف"]) {
    assert.ok(entryForm.includes(`title="${title}"`));
  }

  for (const title of [
    "الاكتساب",
    "التنفيذ وخدمة العملاء",
    "المصاريف التشغيلية العامة",
    "المصاريف المالية",
  ]) {
    assert.ok(entryForm.includes(`title: "${title}"`));
  }

  assert.match(entryForm, /EXPENSE_SECTIONS\.map/);
  assert.match(entryForm, /<table className=\{styles\.revenueTable\}/);
  assert.match(entryForm, /name=\{`gross_\$\{row\.id\}`\}/);
  assert.match(entryForm, /name=\{`refund_\$\{row\.id\}`\}/);
  assert.match(page, /className=\{styles\.monthNavButton\}/);
  assert.match(page, /إدارة مصادر الإيراد/);
  assert.match(page, /إدارة هيكل المصروفات/);

  const entrySurface = `${page}\n${entryForm}`;
  assert.doesNotMatch(entrySurface, /Real Net Profit/i);
  assert.doesNotMatch(entrySurface, /Ultimate CAC/i);
  assert.doesNotMatch(entrySurface, /Contribution Profit/i);
  assert.doesNotMatch(entrySurface, />MER</i);
  assert.doesNotMatch(entrySurface, /ROAS/i);
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

test("Task 8 requires an explicit Per Customer count basis instead of inferring one", () => {
  assert.match(entryForm, /defaultValue=\{row\.basis\}/);
  assert.match(entryForm, /<option value="" disabled>/);
  assert.match(entryForm, /اختر أساس عدد العملاء/);
  assert.match(entryForm, /aria-label=\{`أساس عدد العملاء — \$\{row\.name\}`\}[\s\S]*required/);
  assert.match(page, /basis: String\(entry\?\.customer_count_basis \?\? ""\)/);
});

test("Task 8 page preserves historical snapshot semantics when setup metadata changes", () => {
  assert.match(page, /entry\?\.stream_name_snapshot \?\? stream\.name/);
  assert.match(page, /entry\?\.stream_type_snapshot \?\? stream\.stream_type/);
  assert.match(page, /entry\?\.category_snapshot \?\? expense\.category/);
  assert.match(page, /entry\?\.cost_behavior_snapshot \?\? expense\.cost_behavior/);
});

test("Task 8 month navigation remounts uncontrolled forms so values cannot leak across months", () => {
  assert.match(page, /key=\{`month-picker-\$\{selectedMonth\.monthKey\}`\}/);
  assert.match(page, /key=\{`monthly-form-\$\{selectedMonth\.monthKey\}`\}/);
  assert.match(page, /key=\{`monthly-read-\$\{selectedMonth\.monthKey\}`\}/);
});
