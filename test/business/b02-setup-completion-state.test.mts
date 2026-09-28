import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
