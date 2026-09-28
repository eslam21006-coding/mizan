import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildBusinessSetupHref,
  businessSetupStepForRequirement,
  nextBusinessSetupStep,
  parseBusinessSetupStep,
  previousBusinessSetupStep,
  resolveBusinessSetupResumeStep,
} from "../../src/lib/business/setup-navigation.ts";
import { resolveCoreSetupReadiness } from "../../src/lib/business/readiness.ts";
import { resolveBusinessSetupReadiness } from "../../src/lib/business/setup-readiness.ts";

test("B04 setup step parser accepts only one canonical semantic step", () => {
  for (const step of ["business", "revenue", "expenses", "month"] as const) {
    assert.deepEqual(parseBusinessSetupStep(step), { kind: "valid", step });
  }

  assert.deepEqual(parseBusinessSetupStep(undefined), { kind: "missing" });
  assert.deepEqual(parseBusinessSetupStep(""), { kind: "invalid" });
  assert.deepEqual(parseBusinessSetupStep("2"), { kind: "invalid" });
  assert.deepEqual(parseBusinessSetupStep("costs"), { kind: "invalid" });
  assert.deepEqual(parseBusinessSetupStep(["revenue", "expenses"]), { kind: "invalid" });
});

test("B04 setup hrefs are business-scoped, encoded, and semantic", () => {
  assert.equal(
    buildBusinessSetupHref("business fixture/01", "expenses"),
    "/businesses/business%20fixture%2F01/setup?step=expenses",
  );
  assert.equal(
    buildBusinessSetupHref("business fixture/01"),
    "/businesses/business%20fixture%2F01/setup",
  );
});

test("B04 Core requirements map to stable wizard steps", () => {
  assert.equal(businessSetupStepForRequirement("business_identity"), "business");
  assert.equal(businessSetupStepForRequirement("revenue_setup"), "revenue");
  assert.equal(businessSetupStepForRequirement("expense_setup_review"), "expenses");
  assert.equal(businessSetupStepForRequirement("first_valid_month"), "month");
});

test("B04 Back and Next follow wizard order, not browser history", () => {
  assert.equal(previousBusinessSetupStep("business"), null);
  assert.equal(previousBusinessSetupStep("revenue"), "business");
  assert.equal(previousBusinessSetupStep("expenses"), "revenue");
  assert.equal(previousBusinessSetupStep("month"), "expenses");

  assert.equal(nextBusinessSetupStep("business"), "revenue");
  assert.equal(nextBusinessSetupStep("revenue"), "expenses");
  assert.equal(nextBusinessSetupStep("expenses"), "month");
  assert.equal(nextBusinessSetupStep("month"), null);
});

test("B04 resume always uses the first missing canonical Core requirement", () => {
  const empty = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 0,
    expenseSetup: "not_reviewed",
    validMonthCount: 0,
  });
  const revenueOnly = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup: "not_reviewed",
    validMonthCount: 0,
  });
  const revenueAndExpenses = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup: "reviewed",
    validMonthCount: 0,
  });
  const complete = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup: "reviewed",
    validMonthCount: 1,
  });

  assert.equal(resolveBusinessSetupResumeStep(empty), "revenue");
  assert.equal(resolveBusinessSetupResumeStep(revenueOnly), "expenses");
  assert.equal(resolveBusinessSetupResumeStep(revenueAndExpenses), "month");
  assert.equal(resolveBusinessSetupResumeStep(complete), null);
});

test("B04 load errors never fabricate a resume step", () => {
  const failed = resolveCoreSetupReadiness({
    loadState: "load_error",
    businessIdentityReady: null,
    revenueSourceCount: null,
    expenseSetup: "unknown",
    validMonthCount: null,
  });

  assert.equal(resolveBusinessSetupResumeStep(failed), null);
});

test("B04 canonical readiness counts completed facts independently of order", () => {
  const readiness = resolveBusinessSetupReadiness({
    loadState: "loaded",
    revenueSourceCount: 0,
    expenseSetupReviewedAt: "2026-09-28T10:00:00.000Z",
    validMonthCount: 1,
  });

  assert.equal(readiness.completedStepCount, 3);
  assert.deepEqual(readiness.stepComplete, {
    business: true,
    revenue: false,
    expenses: true,
    month: true,
  });
  assert.deepEqual(readiness.coreSetup.missing, ["revenue_setup"]);
});

test("B04 canonical expense completion ignores legacy expense/history compatibility", () => {
  const readiness = resolveBusinessSetupReadiness({
    loadState: "loaded",
    revenueSourceCount: 1,
    expenseSetupReviewedAt: null,
    validMonthCount: 12,
  });

  assert.equal(readiness.completedStepCount, 3);
  assert.equal(readiness.stepComplete.expenses, false);
  assert.equal(readiness.stepComplete.month, true);
  assert.deepEqual(readiness.coreSetup.missing, ["expense_setup_review"]);
});

test("B04 explicit reviewed-none expense setup completes Step 3 with zero expense rows", () => {
  const readiness = resolveBusinessSetupReadiness({
    loadState: "loaded",
    revenueSourceCount: 1,
    expenseSetupReviewedAt: "2026-09-28T10:00:00.000Z",
    validMonthCount: 0,
  });

  assert.equal(readiness.completedStepCount, 3);
  assert.equal(readiness.stepComplete.expenses, true);
  assert.deepEqual(readiness.coreSetup.missing, ["first_valid_month"]);
});

test("B04 readiness load failure preserves unknown instead of fabricating zero progress", () => {
  const readiness = resolveBusinessSetupReadiness({
    loadState: "load_error",
    revenueSourceCount: null,
    expenseSetupReviewedAt: null,
    validMonthCount: null,
  });

  assert.equal(readiness.completedStepCount, null);
  assert.equal(readiness.coreSetup.loadState, "load_error");
  assert.equal(readiness.coreSetup.expenseSetup, "unknown");
  assert.deepEqual(readiness.stepComplete, {
    business: false,
    revenue: false,
    expenses: false,
    month: false,
  });
});

test("B04 explicit valid step remains addressable even when an earlier requirement is missing", () => {
  const readiness = resolveBusinessSetupReadiness({
    loadState: "loaded",
    revenueSourceCount: 0,
    expenseSetupReviewedAt: "2026-09-28T10:00:00.000Z",
    validMonthCount: 1,
  });

  assert.deepEqual(parseBusinessSetupStep("month"), { kind: "valid", step: "month" });
  assert.equal(resolveBusinessSetupResumeStep(readiness.coreSetup), "revenue");
  assert.equal(readiness.stepComplete.month, true);
});

test("B04 Next gating is based on the selected step completion fact", () => {
  const readiness = resolveBusinessSetupReadiness({
    loadState: "loaded",
    revenueSourceCount: 0,
    expenseSetupReviewedAt: "2026-09-28T10:00:00.000Z",
    validMonthCount: 1,
  });

  assert.equal(readiness.stepComplete.business, true);
  assert.equal(readiness.stepComplete.revenue, false);
  assert.equal(readiness.stepComplete.expenses, true);
  assert.equal(readiness.stepComplete.month, true);
});

const setupPageSource = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/setup/page.tsx", import.meta.url),
  "utf8",
);
const setupLoaderSource = await readFile(
  new URL("../../src/lib/business/setup-loader.ts", import.meta.url),
  "utf8",
);
const setupShellSource = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/setup/business-setup-shell.tsx",
    import.meta.url,
  ),
  "utf8",
);
const creationActionsSource = await readFile(
  new URL("../../src/app/(app)/businesses/new/actions.ts", import.meta.url),
  "utf8",
);
const overviewPageSource = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/page.tsx", import.meta.url),
  "utf8",
);
const monthlySetupNavigationSource = await readFile(
  new URL("../../src/lib/monthly-setup-navigation.ts", import.meta.url),
  "utf8",
);

test("B04 production setup route is read-only and URL state is authoritative", () => {
  assert.doesNotMatch(setupPageSource, /useState|useEffect|localStorage|sessionStorage/);
  assert.doesNotMatch(setupLoaderSource, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.doesNotMatch(setupLoaderSource, /\.from\("expense_items"\)/);
  assert.match(setupPageSource, /parseBusinessSetupStep\(query\.step\)/);
  assert.match(setupPageSource, /resolveBusinessSetupResumeStep/);
  assert.match(setupPageSource, /redirect\(buildBusinessSetupHref/);
});

test("B04 shell is focused and does not reuse full business workspace navigation", () => {
  assert.doesNotMatch(setupShellSource, /BusinessWorkspaceShell|BUSINESS_WORKSPACE_TABS/);
  assert.match(setupShellSource, /BusinessContext/);
  assert.match(setupShellSource, /من 4 خطوات مكتملة/);
});

test("B04 leaves current production entry and hardened setup detours unchanged", () => {
  assert.match(creationActionsSource, /redirect\("\/businesses\?status=created"\)/);
  assert.doesNotMatch(creationActionsSource, /\/setup/);
  assert.doesNotMatch(overviewPageSource, /redirect\([^)]*\/setup/);
  assert.match(monthlySetupNavigationSource, /"revenue-streams" \| "expenses"/);
  assert.doesNotMatch(monthlySetupNavigationSource, /\/setup/);
});

test("B04 distinguishes transient business query failure from an absent business", () => {
  assert.match(setupLoaderSource, /if \(businessError\) \{[\s\S]*throw new Error/);
  assert.match(setupLoaderSource, /if \(!business\) \{[\s\S]*kind: "not_found"/);
});

test("B04 load-error stepper never labels unknown facts as incomplete", () => {
  assert.match(setupShellSource, /loadError[\s\S]*"غير متاحة"/);
  assert.doesNotMatch(setupShellSource, /aria-disabled="true"/);
});
