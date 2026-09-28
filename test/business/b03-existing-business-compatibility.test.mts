import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveBusinessSetupCompatibility } from "../../src/lib/business/setup-compatibility.ts";

const overviewPageSource = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/page.tsx", import.meta.url),
  "utf8",
);
const compatibilitySource = await readFile(
  new URL("../../src/lib/business/setup-compatibility.ts", import.meta.url),
  "utf8",
);

test("B03 established legacy business remains ready from configured expenses and history", () => {
  const compatibility = resolveBusinessSetupCompatibility({
    loadState: "loaded",
    mode: "legacy",
    revenueSourceCount: 2,
    expenseSetupReviewedAt: null,
    configuredExpenseItemCount: 5,
    validMonthCount: 12,
  });

  assert.equal(compatibility.status, "ready");
  assert.equal(compatibility.expenseCompatibilitySource, "legacy_expense_configuration");
  assert.equal(compatibility.effectiveExpenseSetup, "reviewed");
  assert.equal(compatibility.nextRequirement, null);
});

test("B03 legacy zero-expense business with saved history remains ready", () => {
  const compatibility = resolveBusinessSetupCompatibility({
    loadState: "loaded",
    mode: "legacy",
    revenueSourceCount: 1,
    expenseSetupReviewedAt: null,
    configuredExpenseItemCount: 0,
    validMonthCount: 8,
  });

  assert.equal(compatibility.status, "ready");
  assert.equal(compatibility.expenseCompatibilitySource, "legacy_month_history");
  assert.equal(compatibility.nextRequirement, null);
});

test("B03 explicit zero-expense review is authoritative in both modes", () => {
  for (const mode of ["legacy", "canonical"] as const) {
    const compatibility = resolveBusinessSetupCompatibility({
      loadState: "loaded",
      mode,
      revenueSourceCount: 1,
      expenseSetupReviewedAt: "2026-09-28T08:00:00.000Z",
      configuredExpenseItemCount: mode === "legacy" ? null : 0,
      validMonthCount: 1,
    });

    assert.equal(compatibility.status, "ready");
    assert.equal(compatibility.expenseCompatibilitySource, "explicit_review");
    assert.equal(compatibility.effectiveExpenseSetup, "reviewed");
  }
});

test("B03 revenue-only legacy business is partial and needs expense review next", () => {
  const compatibility = resolveBusinessSetupCompatibility({
    loadState: "loaded",
    mode: "legacy",
    revenueSourceCount: 1,
    expenseSetupReviewedAt: null,
    configuredExpenseItemCount: 0,
    validMonthCount: 0,
  });

  assert.equal(compatibility.status, "partially_configured");
  assert.equal(compatibility.nextRequirement, "expense_setup_review");
  assert.equal(compatibility.expenseCompatibilitySource, "none");
});

test("B03 revenue plus legacy expense structure without a month needs first month next", () => {
  const compatibility = resolveBusinessSetupCompatibility({
    loadState: "loaded",
    mode: "legacy",
    revenueSourceCount: 1,
    expenseSetupReviewedAt: null,
    configuredExpenseItemCount: 3,
    validMonthCount: 0,
  });

  assert.equal(compatibility.status, "partially_configured");
  assert.equal(compatibility.nextRequirement, "first_valid_month");
  assert.equal(compatibility.expenseCompatibilitySource, "legacy_expense_configuration");
});

test("B03 empty legacy business needs setup and starts with revenue", () => {
  const compatibility = resolveBusinessSetupCompatibility({
    loadState: "loaded",
    mode: "legacy",
    revenueSourceCount: 0,
    expenseSetupReviewedAt: null,
    configuredExpenseItemCount: 0,
    validMonthCount: 0,
  });

  assert.equal(compatibility.status, "needs_setup");
  assert.equal(compatibility.nextRequirement, "revenue_setup");
});

test("B03 missing revenue stays partial when other legacy setup evidence exists", () => {
  const compatibility = resolveBusinessSetupCompatibility({
    loadState: "loaded",
    mode: "legacy",
    revenueSourceCount: 0,
    expenseSetupReviewedAt: null,
    configuredExpenseItemCount: 4,
    validMonthCount: 3,
  });

  assert.equal(compatibility.status, "partially_configured");
  assert.equal(compatibility.nextRequirement, "revenue_setup");
  assert.equal(compatibility.coreSetup.expenseSetup, "reviewed");
  assert.equal(compatibility.coreSetup.firstValidMonthReady, true);
});

test("B03 canonical mode never substitutes legacy expense or history evidence for explicit review", () => {
  const compatibility = resolveBusinessSetupCompatibility({
    loadState: "loaded",
    mode: "canonical",
    revenueSourceCount: 1,
    expenseSetupReviewedAt: null,
    configuredExpenseItemCount: 5,
    validMonthCount: 4,
  });

  assert.equal(compatibility.status, "partially_configured");
  assert.equal(compatibility.effectiveExpenseSetup, "not_reviewed");
  assert.equal(compatibility.expenseCompatibilitySource, "none");
  assert.equal(compatibility.nextRequirement, "expense_setup_review");
  assert.deepEqual(compatibility.coreSetup.missing, ["expense_setup_review"]);
});

test("B03 load errors fail closed without fabricating compatibility status or action", () => {
  const compatibility = resolveBusinessSetupCompatibility({
    loadState: "load_error",
    mode: "legacy",
    revenueSourceCount: null,
    expenseSetupReviewedAt: null,
    configuredExpenseItemCount: null,
    validMonthCount: null,
  });

  assert.equal(compatibility.loadState, "load_error");
  assert.equal(compatibility.status, null);
  assert.equal(compatibility.nextRequirement, null);
  assert.equal(compatibility.effectiveExpenseSetup, "unknown");
  assert.equal(compatibility.expenseCompatibilitySource, "unknown");
});

test("B03 explicit review wins before legacy evidence is required", () => {
  const compatibility = resolveBusinessSetupCompatibility({
    loadState: "loaded",
    mode: "legacy",
    revenueSourceCount: 1,
    expenseSetupReviewedAt: "2026-09-28T08:00:00.000Z",
    configuredExpenseItemCount: null,
    validMonthCount: 1,
  });

  assert.equal(compatibility.status, "ready");
  assert.equal(compatibility.expenseCompatibilitySource, "explicit_review");
});

test("B03 compatibility resolution is deterministic and does not mutate input", () => {
  const input = Object.freeze({
    loadState: "loaded" as const,
    mode: "legacy" as const,
    revenueSourceCount: 2,
    expenseSetupReviewedAt: null,
    configuredExpenseItemCount: 2,
    validMonthCount: 2,
  });
  const before = { ...input };

  assert.deepEqual(
    resolveBusinessSetupCompatibility(input),
    resolveBusinessSetupCompatibility(input),
  );
  assert.deepEqual(input, before);
});

test("B03 loaded legacy configured-expense count rejects unavailable or invalid evidence", () => {
  assert.throws(
    () =>
      resolveBusinessSetupCompatibility({
        loadState: "loaded",
        mode: "legacy",
        revenueSourceCount: 1,
        expenseSetupReviewedAt: null,
        configuredExpenseItemCount: null,
        validMonthCount: 0,
      }),
    /must be available/,
  );
  assert.throws(
    () =>
      resolveBusinessSetupCompatibility({
        loadState: "loaded",
        mode: "legacy",
        revenueSourceCount: 1,
        expenseSetupReviewedAt: null,
        configuredExpenseItemCount: -1,
        validMonthCount: 0,
      }),
    /non-negative safe integer/,
  );
});

test("B03 Overview loads explicit review and derives configured versus active expense counts", () => {
  assert.match(
    overviewPageSource,
    /\.select\("id,name,base_currency,timezone,owner_user_id,expense_setup_reviewed_at"\)/,
  );
  assert.match(
    overviewPageSource,
    /\.from\("expense_items"\)[\s\S]*?\.select\("id,is_active"\)[\s\S]*?\.eq\("business_id", businessId\)/,
  );
  assert.match(
    overviewPageSource,
    /const configuredExpenseItemCount = expensesResult\.data\?\.length \?\? 0;/,
  );
  assert.match(
    overviewPageSource,
    /const activeExpenseItemCount = \(expensesResult\.data \?\? \[\]\)\.filter\([\s\S]*?expense\.is_active[\s\S]*?\)\.length;/,
  );
  assert.match(overviewPageSource, /configuredExpenseItemCount,/);
  assert.match(
    overviewPageSource,
    /expenseSetupReviewedAt: business\.expense_setup_reviewed_at/,
  );
  assert.match(overviewPageSource, /expenseItemCount: activeExpenseItemCount/);
  assert.match(overviewPageSource, /expenseItemCount=\{activeExpenseItemCount\}/);
});

test("B03 compatibility path is read-only and cannot backfill explicit review or historical data", () => {
  assert.doesNotMatch(compatibilitySource, /createSupabaseServerClient|\.from\(/);
  assert.doesNotMatch(overviewPageSource, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.doesNotMatch(compatibilitySource, /expense_setup_reviewed_at\s*=/);
});
