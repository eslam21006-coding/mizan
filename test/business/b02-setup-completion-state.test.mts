import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  resolveCoreSetupReadiness,
  resolveExpenseSetupReviewState,
} from "../../src/lib/business/readiness.ts";

const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260928074500_b02_setup_completion_state.sql",
    import.meta.url,
  ),
  "utf8",
);

test("B02 adds a nullable expense review timestamp without defaults or backfill", () => {
  assert.match(
    migration,
    /alter table public\.businesses[\s\S]*add column expense_setup_reviewed_at timestamptz\s*;/i,
  );
  assert.doesNotMatch(migration, /expense_setup_reviewed_at[\s\S]*default/i);
  assert.doesNotMatch(migration, /update\s+public\.businesses/i);
  assert.doesNotMatch(migration, /set\s+expense_setup_reviewed_at/i);
});

test("B02 persistence migration changes setup metadata only", () => {
  assert.doesNotMatch(migration, /expense_items/i);
  assert.doesNotMatch(migration, /monthly_periods/i);
  assert.doesNotMatch(migration, /monthly_/i);
  assert.doesNotMatch(migration, /revenue_streams/i);
  assert.doesNotMatch(migration, /transactions/i);
  assert.doesNotMatch(migration, /funnel/i);
  assert.doesNotMatch(migration, /scenario/i);
});

test("B02 does not introduce a parallel setup-state table or boolean completion flag", () => {
  assert.doesNotMatch(migration, /create\s+table/i);
  assert.doesNotMatch(migration, /expense_setup_(?:complete|reviewed)\s+boolean/i);
  assert.doesNotMatch(migration, /setup_(?:step|progress)/i);
});

test("B02 maps persisted expense review metadata into B01 readiness state", () => {
  assert.equal(
    resolveExpenseSetupReviewState({
      loadState: "loaded",
      reviewedAt: "2026-09-28T07:45:00.000Z",
    }),
    "reviewed",
  );
  assert.equal(
    resolveExpenseSetupReviewState({
      loadState: "loaded",
      reviewedAt: null,
    }),
    "not_reviewed",
  );
  assert.equal(
    resolveExpenseSetupReviewState({
      loadState: "load_error",
      reviewedAt: null,
    }),
    "unknown",
  );
});

test("B02 allows explicit reviewed-none expense setup to satisfy Core Setup", () => {
  const expenseSetup = resolveExpenseSetupReviewState({
    loadState: "loaded",
    reviewedAt: "2026-09-28T07:45:00.000Z",
  });
  const readiness = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup,
    validMonthCount: 1,
  });

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.expenseSetup, "reviewed");
  assert.deepEqual(readiness.missing, []);
});

test("B02 keeps explicit zero expenses incomplete until review is confirmed", () => {
  const expenseSetup = resolveExpenseSetupReviewState({
    loadState: "loaded",
    reviewedAt: null,
  });
  const readiness = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup,
    validMonthCount: 1,
  });

  assert.equal(readiness.status, "incomplete");
  assert.equal(readiness.expenseSetup, "not_reviewed");
  assert.deepEqual(readiness.missing, ["expense_setup_review"]);
});
