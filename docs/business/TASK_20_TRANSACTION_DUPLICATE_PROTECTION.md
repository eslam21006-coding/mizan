# Task 20 — Transaction Duplicate Protection

## Scope

Task 20 turns the validated CSV/XLSX rows from Tasks 17–19 into durable customer transactions without silently double-counting repeated imports.

Task 21 customer identity/grouping, cohorts, acquisition dates, and Observed LTV are explicitly out of scope.

## Duplicate identity

Within one business and one normalized transaction source:

1. If a non-empty Transaction ID exists, the duplicate identity is `business + source + Transaction ID`.
2. If Transaction ID is absent, the fallback identity is `business + source + normalized email + transaction date + amount collected`.

Customer email is normalized with trim + lowercase. Transaction source is normalized with trim + lowercase. Transaction IDs are trimmed but remain case-sensitive.

## Persistence and security

- `public.customer_transactions` stores imported rows.
- Authenticated clients do not receive direct INSERT/UPDATE/DELETE privileges on the table.
- Imports go through `public.import_customer_transactions(...)`.
- Only an admin or the business owner can execute an import for that business.
- RLS restricts reads to authorized business users/admins.
- Partial unique indexes enforce both duplicate identities at the database boundary, including concurrent requests.
- Duplicate rows use `ON CONFLICT DO NOTHING` and are returned to the caller as an explicit skipped count.

## Import behavior

- Validation must succeed before the UI enables import.
- A transaction source is required and must be reused consistently for exports from the same gateway.
- Rows are sent to the guarded RPC in chunks of at most 500.
- If a later chunk fails, the UI reports how many rows were already processed and states that retrying is safe because previously inserted rows will be deduplicated.

## Acceptance tests

The database-backed test matrix proves:

- duplicates inside one upload are skipped;
- importing the same rows a second time inserts zero new rows;
- aggregate cash/revenue does not double after re-import;
- Transaction ID wins over changed fallback fields when present;
- fallback identity includes source;
- direct authenticated inserts are blocked;
- another business owner and a read-only member cannot import into the business;
- admins can import;
- RLS prevents cross-business reads.

The Playwright verification proves the Arabic RTL UI exposes Transaction ID mapping, source entry, imported/skipped counts, repeated-import feedback, and mobile containment.
