# Task 21 — Customer Identity & Transaction Grouping

## Scope

Task 21 groups durable Task 20 transactions into business-scoped customer identities using the locked V1 identity rule:

`customer identity = business + normalized customer email`

The normalized email is already persisted by the guarded Task 20 import boundary using lowercase + trim. The same email in two different businesses is therefore two different customer identities.

Task 21 deliberately does not create cohorts or calculate Observed LTV. Those remain Tasks 22–23.

## Grouping model

`public.customer_transaction_groups` is a read-only PostgreSQL view over `public.customer_transactions`.

The view is derived rather than duplicated into another mutable customer-summary table, so later imports, refunds, corrections introduced through reviewed transaction flows, and earlier historical collections automatically affect the customer group without a second synchronization path.

For each `business_id + customer_email` identity it exposes:

- normalized customer email;
- acquisition timestamp;
- acquisition reporting date;
- successful transaction count;
- successful collection count;
- successful refund count;
- Gross Cash Collected;
- Refunds;
- Net Cash Collected;
- last successful transaction timestamp;
- business base currency.

These are transaction-history facts. They are not labeled LTV.

## Acquisition rule

Acquisition is the earliest successful positive collection for that normalized email inside that business.

- A later purchase, upsell, renewal, or backend purchase never resets acquisition.
- A refund never establishes acquisition.
- A customer identity that currently has only refunds remains visible with a null acquisition timestamp/date.
- Because Task 20 stores canonical `transaction_at` in the business reporting-timezone model, acquisition ordering uses the preserved canonical instant rather than import order.

## Financial grouping rules

For one customer identity:

`Gross Cash Collected = sum(successful collection magnitudes)`

`Refunds = sum(successful refund magnitudes)`

`Net Cash Collected = Gross Cash Collected - Refunds`

Refunds remain contra-revenue and are never treated as expenses.

The authoritative aggregation is PostgreSQL `numeric`; the UI renders returned decimal values and does not recompute customer cash totals with JavaScript floating point.

## Security

The grouping view uses PostgreSQL `security_invoker = true`, so reads execute with the caller's permissions and inherit Task 20 `customer_transactions` RLS.

- authenticated users can read only customer groups for businesses they are authorized to read;
- admins can read all business groups;
- unrelated mentees cannot read another business's groups even when they manipulate `business_id`;
- anonymous users receive no view privilege;
- the view is read-only from the application perspective and does not introduce a new write path.

## Arabic RTL UI

Each business now has a customer-grouping screen at:

`/businesses/[businessId]/customers`

The screen shows normalized customer identities, acquisition status/date, transaction counts, Gross Cash Collected, Refunds, and Net Cash Collected. It pages through the read-only view and keeps the existing transaction-import entry point available.

A refund-only identity is explicitly shown as not yet acquired instead of assigning the refund date as acquisition.

## Acceptance criteria

Task 21 is complete only when all of the following are true:

1. Customer identity is scoped by `business_id + normalized email`.
2. Case/whitespace variants imported into one business collapse into one identity.
3. The same normalized email in another business remains a separate identity.
4. Acquisition timestamp/date are the earliest successful positive collection, independent of import order.
5. Later purchases do not reset acquisition.
6. Refunds never establish acquisition.
7. Refund-only identities remain grouped with null acquisition.
8. Known-input SQL tests prove exact transaction counts, Gross Cash, Refunds, and Net Cash.
9. Grouped financial values use PostgreSQL numeric arithmetic; the UI does not recompute them with binary floating point.
10. RLS/privilege tests prove unrelated mentees and anonymous users cannot read protected groups while authorized members/admins can.
11. Arabic RTL browser verification covers grouped identities, refund-only acquisition state, exact displayed grouped amounts, and 390px mobile containment.
12. Task 22 cohorts and Task 23 Observed LTV remain out of scope.
