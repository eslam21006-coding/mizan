import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20260818061945_task_4_business_ownership_rls.sql",
  import.meta.url,
);
const migration = await readFile(migrationUrl, "utf8");

test("Task 4 migration enables RLS and never grants table access to anon", () => {
  assert.match(migration, /alter table public\.businesses enable row level security;/);
  assert.match(migration, /alter table public\.business_memberships enable row level security;/);
  assert.match(migration, /revoke all on public\.businesses from anon;/);
  assert.match(migration, /revoke all on public\.business_memberships from anon;/);
  assert.doesNotMatch(migration, /grant\s+.+\s+on public\.(?:businesses|business_memberships) to anon;/i);
});

test("Admin authorization comes from fresh server-controlled app metadata", () => {
  assert.match(migration, /from auth\.users as u/);
  assert.match(migration, /raw_app_meta_data ->> 'role' = 'admin'/);
  assert.doesNotMatch(migration, /user_meta_data|raw_user_meta_data/);
  assert.match(migration, /security definer\nset search_path = ''/);
});

test("Mentees cannot directly manage memberships or transfer ownership", () => {
  assert.match(
    migration,
    /create policy business_memberships_update[\s\S]*?using \(\(select private\.is_admin\(\)\)\)/,
  );
  assert.match(
    migration,
    /create policy business_memberships_delete[\s\S]*?using \(\(select private\.is_admin\(\)\)\)/,
  );
  assert.match(
    migration,
    /create policy businesses_update[\s\S]*?owner_user_id = \(select auth\.uid\(\)\)[\s\S]*?with check[\s\S]*?owner_user_id = \(select auth\.uid\(\)\)/,
  );
});

test("Business currencies stay within the V1 currency contract", () => {
  for (const currency of ["USD", "AED", "SAR", "EGP", "KWD", "QAR", "JOD", "EUR"]) {
    assert.match(migration, new RegExp(`'${currency}'`));
  }
});
