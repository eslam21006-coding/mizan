import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20260818061945_task_4_business_ownership_rls.sql",
  import.meta.url,
);
const migration = await readFile(migrationUrl, "utf8");

test("Task 4 migration enables RLS and resets exposed table privileges", () => {
  assert.match(migration, /alter table public\.businesses enable row level security;/);
  assert.match(migration, /alter table public\.business_memberships enable row level security;/);
  assert.match(migration, /revoke all on public\.businesses from anon;/);
  assert.match(migration, /revoke all on public\.business_memberships from anon;/);
  assert.match(migration, /revoke all on public\.businesses from authenticated;/);
  assert.match(migration, /revoke all on public\.business_memberships from authenticated;/);
  assert.doesNotMatch(migration, /grant\s+.+\s+on public\.(?:businesses|business_memberships) to anon;/i);
});

test("Admin authorization comes from fresh server-controlled app metadata", () => {
  assert.match(migration, /from auth\.users as u/);
  assert.match(migration, /raw_app_meta_data ->> 'role' = 'admin'/);
  assert.doesNotMatch(migration, /user_meta_data|raw_user_meta_data/);
  assert.match(migration, /security definer\nset search_path = ''/);
});

test("Owner memberships are synchronized only through the business owner field", () => {
  assert.match(
    migration,
    /grant select, insert, delete on public\.business_memberships to authenticated;/,
  );
  assert.doesNotMatch(migration, /grant[^;]*update[^;]*public\.business_memberships to authenticated;/i);
  assert.doesNotMatch(migration, /create policy business_memberships_update/);
  assert.match(
    migration,
    /create policy business_memberships_insert_member[\s\S]*?private\.is_admin\(\)[\s\S]*?membership_role = 'member'/,
  );
  assert.match(
    migration,
    /create policy business_memberships_delete_member[\s\S]*?private\.is_admin\(\)[\s\S]*?membership_role = 'member'/,
  );
  assert.match(
    migration,
    /function private\.sync_business_owner_membership\(\)[\s\S]*?security definer[\s\S]*?set search_path = ''/,
  );
  assert.match(
    migration,
    /tg_op = 'UPDATE' and old\.owner_user_id is not distinct from new\.owner_user_id[\s\S]*?return new;/,
  );
  assert.match(
    migration,
    /revoke all on function private\.sync_business_owner_membership\(\) from authenticated;/,
  );
});

test("Mentee business updates cannot transfer ownership", () => {
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
