# Task 24 — Lifetime Revenue Stream Analysis

## Scope

Task 24 extends the transaction-history customer economics model with explicit revenue-stream attribution.

- A persisted customer transaction may be assigned to one existing business revenue stream.
- Attribution is explicit. Mizan does not infer a stream from payment source, amount, timing, customer email, or funnel.
- Unattributed transactions remain valid and are shown separately as **غير منسوب**.
- Revenue-stream analysis uses only successful persisted transaction history for customers that belong to an acquisition cohort.
- Refunds reduce the attributed stream's revenue and are never counted as expenses.
- Current lifetime analysis is cumulative through the business-local current date, consistent with Observed LTV.
- Revenue stream identity is business-scoped and protected by existing RLS plus a security-definer attribution RPC.

## Views

### `public.customer_cohort_revenue_stream_analysis`

Groups realized lifetime transaction activity by:

- business
- acquisition cohort
- explicitly assigned revenue stream, or unattributed

Exposes transaction/customer counts, Gross Cash, Refunds, Net Cash, exact text values, stream type, and currency.

### `public.customer_lifetime_revenue_stream_analysis`

Rolls cohort rows into the current business-level lifetime revenue-stream mix.

## Invariants

1. Revenue-stream attribution never changes customer acquisition date or cohort membership.
2. Revenue-stream attribution never changes duplicate identity.
3. A stream from another business cannot be assigned.
4. A non-owner mentee/member cannot mutate attribution.
5. Admin may manage any business.
6. Anonymous access is denied.
7. Unattributed cash remains visible rather than silently excluded.
8. Sum of Task 24 lifetime stream Net Cash must reconcile to current cohort Net Cash for the same acquired-customer history.

## Acceptance criteria

- Explicit transaction-to-stream attribution works and is auditable.
- Front-End and Backend stream types remain distinguishable.
- Unattributed transaction cash is visible.
- Refunds reduce the same attributed stream.
- Exact PostgreSQL numeric transport is preserved.
- RLS/unauthorized tests pass.
- Arabic RTL UI provides stream analysis and an attribution workflow.
- No inferred attribution is introduced.
