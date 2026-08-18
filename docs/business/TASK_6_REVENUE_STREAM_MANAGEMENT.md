# Task 6 — Revenue Stream Management

## Scope

Task 6 lets an authenticated Mizan user manage the revenue streams that belong to one business.

Each revenue stream stores only:

- name;
- classification: `front_end` or `backend`;
- active/inactive status.

No financial amount, price, cash collected, attribution, LTV, funnel, or expense data is introduced in this task.

## Classification

Mizan uses two business-level revenue-stream classifications:

- **Front-End**: cash streams intended to acquire or liquidate acquisition cost.
- **Backend**: cash streams generated after the initial front-end relationship.

The classification is metadata only in Task 6. Self-liquidation calculations arrive later when transaction and cost data exist.

## Lifecycle

Revenue streams are history-preserving records.

Users may:

- create;
- rename;
- reclassify between Front-End and Backend;
- deactivate;
- reactivate.

Task 6 intentionally does **not** expose hard delete. Later transactions may reference these rows, so deactivation is the safe lifecycle boundary.

## Idempotent creation

Every rendered create form receives a server-generated UUID `creation_request_id`.

The database requires it explicitly and enforces:

- `UNIQUE (business_id, creation_request_id)`;
- immutability after creation.

If one request is delivered twice, the second insert cannot create a second revenue stream. The server treats the unique-key collision as success only when the existing row belongs to the same business and has the same submitted name and classification.

## Authorization

Task 4 remains the business ownership authority.

- Admin: may read and manage revenue streams in every business.
- Business owner: may read and manage streams in their own business.
- Business member: may read streams in that business but cannot create or modify them.
- Other Mentees: cannot read or write the business or its streams.

Authorization is enforced by PostgreSQL RLS, not by hidden UI.

The browser may submit a `business_id` because it identifies the selected resource, but it never submits an owner/user identity. Manipulating `business_id` must not bypass RLS.

## UX

Arabic RTL management lives at:

`/businesses/[businessId]/revenue-streams`

The page:

- shows the business name and base currency;
- explains Front-End vs Backend in short Arabic copy;
- creates a stream with name and classification;
- lists existing streams;
- edits name, classification, and active state inline;
- clearly distinguishes active and inactive streams;
- links back to the business list.

Business cards link directly to revenue-stream management.

## Verification

Task 6 is complete only when:

1. `public.revenue_streams` exists with RLS enabled;
2. allowed classifications are exactly `front_end` and `backend`;
3. new rows require an explicit `creation_request_id`;
4. duplicate delivery produces exactly one row;
5. `creation_request_id` cannot be changed after creation;
6. Admin and business owner can manage streams;
7. business members are read-only;
8. Mentee A cannot read, create, modify, or move streams into Mentee B's business;
9. authenticated users have no hard-delete permission on revenue streams;
10. the Arabic RTL page works on desktop and mobile;
11. Task 4 and Task 5 tests still pass;
12. Supabase security/performance advisors and CodeRabbit are clear before merge.
