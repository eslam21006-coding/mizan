# Task 39 — Full Security Review

## Purpose

Task 39 converts Mizan's accumulated feature-level authorization tests into a final system-wide security gate. It does not introduce a new product role or weaken an existing permission. Its job is to prove that newly added database objects and application auth code remain inside the security model established by earlier tasks.

## Trust boundaries

### Database is authoritative

- `auth.users.raw_app_meta_data` is the authoritative Admin-role source.
- JWT `app_metadata` is useful for application routing, but a stale or forged Admin claim must never grant database access.
- Business ownership and `business_memberships` are the authoritative tenant-access sources.
- Database policies and guarded RPCs remain mandatory even when the UI already hides a control.

### Tenant roles

- **Admin:** may read/manage every business through fresh database authorization.
- **Owner:** may read/manage only the business they own.
- **Member/Mentee:** may read only assigned businesses unless a specific feature grants a narrower operation.
- **Outsider:** has no access to unrelated business data.
- **anon:** has no direct access to Mizan application data or application RPCs.

## Global database invariants

The final catalog-level test runs after every migration and verifies:

1. Every application base/partitioned table in `public` has RLS enabled.
2. `anon` does not inherit direct privileges on application tables, views, materialized views, or sequences.
3. Every public application view uses `security_invoker=true`, so underlying RLS remains authoritative.
4. Every `SECURITY DEFINER` function in `public` or `private` pins a safe `search_path` that does not include `public` or `$user`.
5. `anon` cannot execute application functions, including privileges inherited from PostgreSQL's `PUBLIC` pseudo-role.
6. Client roles cannot create objects in the `public` or `private` schemas.
7. `anon` has no `private` schema usage.
8. `auth.users` is not directly selectable or mutable by `anon` or `authenticated`.
9. A consolidated role/tenant smoke test proves owner, member, outsider, forged/stale-JWT Admin, and authoritative Admin behavior on the final schema.

These checks supplement—rather than replace—the detailed feature-specific RLS/RPC tests for monthly actuals, funnels, transaction imports, cohorts/LTV, lifetime economics, scenarios, and Admin mentee management.

## Application-source invariants

Automated source-boundary tests verify:

- the server Supabase client remains `server-only`;
- runtime application configuration contains only the public Supabase URL and publishable key;
- no application source references a Supabase service-role/secret credential;
- the route gate verifies claims with `auth.getClaims()` rather than using `auth.getSession()` as an authorization decision;
- no source file introduces a `getSession()` authorization path.

## Threats covered

- cross-tenant ID manipulation;
- stale or forged JWT Admin claims;
- accidental RLS omission on a new table;
- owner-rights escalation by a read-only member;
- unintended anonymous relation/function grants;
- default PostgreSQL `PUBLIC EXECUTE` leakage on a new function;
- definer-function search-path hijacking;
- security-definer views bypassing underlying RLS;
- direct client access to `auth.users`;
- accidentally shipping service-role credentials into application source;
- external/open redirect and role metadata issues already covered by the existing auth contract suite.

## Explicit non-goals

- Task 39 does not create a new role model.
- It does not move authorization from the database into middleware.
- It does not expose service-role credentials to the Next.js runtime.
- It does not change financial calculations or historical business data.
- It does not perform Task 40 production/final-verification work.

## Merge gate

Task 39 is complete only when:

- static/type checks pass;
- auth source-boundary tests pass;
- the full existing business and database/RLS suite passes;
- the final catalog security audit passes on a fresh disposable PostgreSQL database;
- production build and browser regression verification pass;
- Vercel preview succeeds;
- review has zero unresolved actionable findings.
