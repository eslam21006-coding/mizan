# Task 4 — Business Ownership & RLS Security

## Scope

Task 4 establishes the database authorization boundary for Mizan businesses. It does not add financial tables, transaction imports, funnels, or business UI.

## Data model

### `public.businesses`

- `id`: UUID primary key.
- `name`: required, 1–120 non-whitespace characters.
- `base_currency`: one V1 currency: USD, AED, SAR, EGP, KWD, QAR, JOD, EUR.
- `owner_user_id`: references `auth.users`; deleting an owner is restricted until their business is reassigned or removed.
- `created_at`: creation timestamp.

### `public.business_memberships`

- Composite key: `business_id + user_id`.
- `membership_role`: `owner` or `member`.
- Exactly one `owner` membership is allowed per business.
- The owner membership is synchronized automatically from `businesses.owner_user_id`.
- Direct authenticated membership writes are limited to Admin-created/deleted `member` rows. The synchronized `owner` row cannot be directly updated, deleted, demoted, or replaced through membership-table RLS.

## Authorization rules

### Admin

Admin authorization is checked against the current `auth.users.raw_app_meta_data.role` value through `private.is_admin()`. It does not trust `user_metadata`, and it does not rely on a potentially stale JWT Admin claim.

An Admin can read and manage all businesses. An Admin can add/remove read-only `member` assignments. Ownership changes must be made through `businesses.owner_user_id`; the database trigger then atomically replaces the synchronized owner membership.

### Mentee owner

A Mentee may:

- create a business only with themselves as `owner_user_id`;
- read their owned businesses;
- update or delete their owned businesses;
- read their own membership rows.

A Mentee may not:

- transfer ownership to another user;
- write membership rows directly;
- update or delete membership rows;
- read another user’s membership rows.

### Read-only member

An Admin may explicitly add another user as a `member`. That membership grants read access to the business but does not grant update/delete rights or ownership-transfer rights.

## RLS boundary

RLS is enabled on every Task 4 table in the exposed `public` schema. `anon` receives no table privileges. `authenticated` receives only the table privileges required for its policy-controlled operations.

Privileged helper/trigger functions live in the non-exposed `private` schema, use a fixed empty `search_path`, and expose only the minimum execution privilege required. The owner-membership synchronization trigger uses `SECURITY DEFINER` specifically so users cannot acquire equivalent direct membership-table privileges.

## Verification

`test/rls/task-4-business-ownership.test.sql` is a transaction-safe attack matrix. It verifies:

1. owner membership is created automatically;
2. an owner can update their business while redundantly sending the unchanged `owner_user_id`;
3. Mentee A cannot read Mentee B’s business;
4. Mentee A cannot see Mentee B’s membership;
5. Mentee A cannot update Mentee B’s business;
6. Mentee A cannot self-add to Mentee B’s business;
7. Mentee A cannot transfer their business to another owner;
8. Admin sees all businesses and memberships;
9. Admin cannot directly delete/demote the synchronized owner membership;
10. a stale JWT claiming `admin` does not grant Admin rights when the current Auth record says `mentee`;
11. an explicit `member` assignment grants read-only access only;
12. an Admin ownership transfer through `businesses.owner_user_id` atomically synchronizes the owner membership.

The attack matrix runs inside a transaction and rolls back all fixture data.

### Database-backed CI execution

GitHub Actions starts a disposable PostgreSQL 17 service named `mizan_test`. `npm test` runs both the migration contract tests and `test/rls/run-attack-matrix.mjs`. The runner:

1. bootstraps only the minimal Supabase Auth roles, `auth.users`, and `auth.uid()` behavior required by the migration;
2. applies the actual Task 4 migration;
3. executes the full SQL attack matrix through `psql` with `ON_ERROR_STOP=1` so any unexpected permission or RLS behavior fails CI.

The bootstrap intentionally resets schemas, so the runner refuses to execute unless `RLS_TEST_DATABASE_URL` points to a loopback host and the database name ends in `_test`. It never uses hosted Supabase credentials or a generic production database URL.
