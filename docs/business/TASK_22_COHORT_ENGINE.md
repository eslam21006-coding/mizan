# Task 22 — Cohort Engine

## Scope

Task 22 converts Task 21 customer identities into monthly acquisition cohorts without calculating Observed LTV yet.

A customer belongs to the calendar month containing their acquisition date:

`cohort_month = calendar month of earliest successful positive collection`

Customer identity remains business-scoped:

`business + normalized customer email`

Refund-only identities have no acquisition date and therefore do not belong to an acquisition cohort.

## Cohort membership

`public.customer_acquisition_cohorts` is a read-only, security-invoker view derived from `public.customer_transaction_groups`.

For each acquired customer it exposes:

- business;
- normalized customer email;
- acquisition timestamp/date;
- cohort month;
- business base currency.

A later purchase, renewal, upsell, or backend purchase does not move the customer into a later cohort.

## Transaction reporting-basis invariant

Cohort math requires one reporting currency and one reporting calendar for the durable transaction history.

Before the cohort views are enabled, the migration verifies that every persisted customer transaction:

- uses the business's current V1 base currency; and
- has a reporting date equal to its canonical `transaction_at` interpreted in the business timezone.

After customer transaction history exists, `businesses.base_currency` and `businesses.timezone` become immutable through ordinary writes. A future currency/timezone change therefore requires an explicit reviewed history migration that reconciles the persisted transaction history rather than silently mixing currencies or reporting calendars.

The database also enforces the same currency/date invariant on future direct transaction writes. This is in addition to the guarded Task 20 import RPC validation.

## Original cohort size

`Original Cohort Size = unique customers acquired in that cohort month`

The denominator is fixed by acquisition membership. It does not shrink because of refunds, inactivity, or churn.

A legitimate historical import that reveals an earlier true acquisition can correct cohort membership because the source transaction history itself changed. That is a history correction, not churn-based denominator shrinkage.

## Monthly cohort activity

`public.customer_cohort_monthly_activity` aggregates all successful transaction activity for the original cohort customers by calendar activity month.

For each `business + cohort_month + activity_month` it exposes:

- fixed original cohort size;
- transaction / collection / refund counts;
- Gross Cash Collected;
- Refunds;
- Net Cash Collected;
- exact PostgreSQL-generated text forms of financial totals;
- enforced business base currency.

Currency is not part of the cohort grouping key: the database invariant guarantees exactly one transaction currency for the business history, preventing split denominators or duplicated cohort rows.

Refunds remain contra-revenue:

`Net Cash Collected = Gross Cash Collected - Refunds`

The cohort activity view does not calculate or label LTV.

## Security

Both views use `security_invoker = true` and inherit the underlying business/customer transaction RLS boundary.

- authorized business members can read their allowed cohort data;
- admins can read all allowed businesses;
- unrelated mentees cannot read another business by manipulating `business_id`;
- anonymous users have no view privilege.

## Acceptance criteria

Task 22 is complete only when:

1. Every acquired customer belongs to exactly one calendar-month cohort inside one business.
2. Acquisition month comes from the earliest successful positive collection.
3. Later transactions do not reset cohort membership.
4. Refund-only identities are excluded from acquisition cohorts.
5. Original cohort size counts unique acquired customers and does not shrink because of refunds/inactivity/churn.
6. Monthly cohort activity preserves collection/refund contra-revenue semantics.
7. Known-input SQL tests prove a four-customer January cohort, a separate February cohort, February upsell activity, and March refund activity.
8. Monetary aggregation uses PostgreSQL `numeric`; browser/display transport can use exact canonical text values.
9. Base currency and reporting timezone cannot change through ordinary writes after transaction history exists; future transaction writes must match the business reporting basis.
10. Unauthorized cross-business and anonymous reads are blocked; authorized member/admin reads are proven.
11. Task 23 Observed LTV remains a separate calculation layer implemented only after this Task 22 cohort base is established in the approved combined pair.
