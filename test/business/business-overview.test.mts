import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildBusinessMonthlyHref,
  resolveBusinessOverviewHealth,
} from "../../src/lib/business-overview.ts";

const overviewPage = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/page.tsx", import.meta.url),
  "utf8",
);

const businessId = "123e4567-e89b-42d3-a456-426614174000";

test("N37 sends incomplete setup to Revenue Sources before monthly entry", () => {
  const health = resolveBusinessOverviewHealth({
    businessId,
    currentMonthKey: "2026-09",
    revenueSourceCount: 0,
    expenseItemCount: 4,
    currentMonthSaved: false,
    latestSavedMonthKey: "2026-08",
    canManage: true,
    dataLoadError: false,
  });

  assert.equal(health.revenueSourcesReady, false);
  assert.equal(health.expensesReady, true);
  assert.deepEqual(health.nextAction, {
    kind: "revenue-streams",
    href: `/businesses/${businessId}/revenue-streams`,
    label: "إضافة مصدر إيراد",
  });
});

test("N37 sends the next incomplete setup step to Expense Structure", () => {
  const health = resolveBusinessOverviewHealth({
    businessId,
    currentMonthKey: "2026-09",
    revenueSourceCount: 2,
    expenseItemCount: 0,
    currentMonthSaved: false,
    latestSavedMonthKey: null,
    canManage: true,
    dataLoadError: false,
  });

  assert.equal(health.revenueSourcesReady, true);
  assert.equal(health.expensesReady, false);
  assert.equal(health.nextAction?.kind, "expenses");
  assert.equal(health.nextAction?.href, `/businesses/${businessId}/expenses`);
  assert.equal(health.nextAction?.label, "إضافة بند مصروف");
});

test("N37 opens the current Monthly month once setup is ready", () => {
  const health = resolveBusinessOverviewHealth({
    businessId,
    currentMonthKey: "2026-09",
    revenueSourceCount: 2,
    expenseItemCount: 4,
    currentMonthSaved: true,
    latestSavedMonthKey: "2026-09",
    canManage: true,
    dataLoadError: false,
  });

  assert.equal(health.currentMonthSaved, true);
  assert.equal(health.latestSavedMonthKey, "2026-09");
  assert.equal(health.nextAction?.kind, "monthly");
  assert.equal(
    health.nextAction?.href,
    `/businesses/${businessId}/monthly?month=2026-09`,
  );
  assert.match(health.nextAction?.label ?? "", /^فتح أرقام /);
});

test("N37 uses review wording for read-only users without changing destinations", () => {
  const health = resolveBusinessOverviewHealth({
    businessId,
    currentMonthKey: "2026-09",
    revenueSourceCount: 0,
    expenseItemCount: 0,
    currentMonthSaved: false,
    latestSavedMonthKey: null,
    canManage: false,
    dataLoadError: false,
  });

  assert.equal(health.nextAction?.label, "مراجعة مصادر الإيراد");
  assert.equal(health.nextAction?.href, `/businesses/${businessId}/revenue-streams`);
});

test("N37 fails closed when setup or monthly status cannot be loaded", () => {
  const health = resolveBusinessOverviewHealth({
    businessId,
    currentMonthKey: "2026-09",
    revenueSourceCount: 9,
    expenseItemCount: 9,
    currentMonthSaved: true,
    latestSavedMonthKey: "2026-09",
    canManage: true,
    dataLoadError: true,
  });

  assert.equal(health.dataLoadError, true);
  assert.equal(health.nextAction, null);
  assert.equal(health.latestSavedMonthKey, null);
  assert.equal(health.currentMonthSaved, false);
});

test("N37 Monthly href encodes the business ID and preserves exact month state", () => {
  assert.equal(
    buildBusinessMonthlyHref("business / unsafe?x=1", "2026-09"),
    "/businesses/business%20%2F%20unsafe%3Fx%3D1/monthly?month=2026-09",
  );
});

test("N37 production Overview reads active setup and current/latest saved monthly periods", () => {
  assert.match(overviewPage, /\.from\("revenue_streams"\)[\s\S]*\.eq\("is_active", true\)/);
  assert.match(overviewPage, /\.from\("expense_items"\)[\s\S]*\.eq\("is_active", true\)/);
  assert.match(
    overviewPage,
    /\.from\("monthly_periods"\)[\s\S]*\.eq\("month_start", currentMonthStart\)[\s\S]*\.maybeSingle\(\)/,
  );
  assert.match(
    overviewPage,
    /\.from\("monthly_periods"\)[\s\S]*\.order\("month_start", \{ ascending: false \}\)[\s\S]*\.limit\(1\)/,
  );
  assert.match(overviewPage, /const dataLoadError = Boolean\(/);
  assert.match(overviewPage, /<BusinessOverviewPanel/);
});
