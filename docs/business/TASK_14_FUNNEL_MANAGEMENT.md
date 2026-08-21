# Task 14 — Funnel Management

## Scope

Task 14 introduces optional funnel structure for each Mizan business.

A business may have:

- no funnels;
- one funnel; or
- multiple funnels.

Business-level economics remain primary. Creating, editing, activating, or deactivating a funnel does not change business revenue, costs, profit, CAC, or any other financial KPI by itself.

## Stored funnel fields

Task 14 stores structure only:

- Business
- Funnel name
- Funnel type
- Active/inactive state
- Creation request ID for idempotency
- Created/updated timestamps

It does not store monthly funnel performance inputs yet.

## Supported funnel types

V1 Funnel Management supports exactly:

- Webinar
- Lead Gen
- Low Ticket
- Organic
- Referral
- Event

These types organize reporting and do not imply a universal benchmark or financial formula.

## Explicitly deferred to Task 15

Task 14 does not store or calculate:

- Ad Spend
- Leads
- Booked Calls
- Showed Calls
- Qualified Calls
- Sales
- New Customers
- Cash Collected
- Attributed Revenue
- CPL
- Cost Per Booking
- Cost Per Show
- Cost Per Qualified Call
- Show Rate
- Qualification Rate
- Close Rate
- Lead-to-Sale Rate
- Media CAC
- funnel ROAS
- business/funnel ad-spend reconciliation

Those belong to Task 15 — Funnel Monthly Metrics & Calculations.

## Explicitly deferred to Task 16

Task 14 does not implement self-liquidating funnel economics, including:

- Front-End Contribution Profit
- Ad Liquidation Rate
- Effective Remaining Ad Cost

Those belong to Task 16 — Self-Liquidating Funnel Engine.

## Lifecycle and history

Funnels are never hard-deleted through authenticated product access.

A user deactivates a funnel when it should stop appearing in future entry flows. The row remains available for future historical linkage.

The funnel `id`, `business_id`, `creation_request_id`, and `created_at` are immutable after creation. A funnel cannot be moved between businesses, assigned a new historical identity, or have its creation time rewritten later. Normal edits may change only the user-editable structure fields while `updated_at` advances automatically.

The funnel-to-business foreign key uses `ON DELETE RESTRICT`. If a business has funnel history, a privileged business deletion attempt is rejected instead of cascading into `public.funnels`. Any future business-deletion feature must define an explicit archival/retention policy rather than silently erasing funnel history.

## Creation idempotency

Every create form receives a server-generated UUID `creation_request_id`.

The database enforces a unique `(business_id, creation_request_id)` pair. A duplicate delivery of the same create request cannot create a second funnel.

The request ID is not an authorization credential. Database RLS remains the authorization boundary.

## Permissions

Funnel access inherits the established business boundary:

- Admin: read/manage funnels across businesses.
- Business owner: read/manage funnels for owned businesses.
- Business member: read-only.
- Unrelated Mentee: cannot read or modify another business's funnels.
- Anonymous users: no table access.

RLS is enabled on `public.funnels`. Authenticated users receive SELECT/INSERT/UPDATE only; no DELETE grant or delete policy exists.

The UI hides management controls for read-only members, but that is an affordance only. PostgreSQL RLS is the security control.

## Arabic RTL UX

The management page lives at:

`/businesses/[businessId]/funnels`

It provides:

- explanation that funnels are optional;
- create form for authorized managers;
- funnel type selection;
- active/inactive status;
- edit/deactivate flow;
- read-only presentation for business members;
- responsive desktop/mobile layout.

## Verification requirements

Before merge:

1. Unit/contract tests must verify exact funnel types, normalization, idempotency, no hard delete, retention-safe business deletion, and Task 14's structure-only boundary.
2. Database tests must verify owner access, cross-tenant denial, member read-only access, Admin access, anonymous denial, invalid types, request-ID uniqueness, immutable identity/creation time, rejected business deletion when funnel history exists, and hard-delete denial.
3. The Task 14 migrations and SQL attack matrix must execute in the normal database-backed CI path.
4. Authenticated browser verification must create, edit, reclassify, and deactivate a funnel.
5. Browser verification must confirm Arabic `lang=ar`, `dir=rtl`, responsive 390px layout, and no console/page errors.
6. Full CI must pass on the exact PR head.
7. CodeRabbit must have zero unresolved actionable comments.
8. Founder approval is required before merge.
