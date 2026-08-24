# Task 20 — Transaction Duplicate Protection

## Scope

Task 20 turns the validated CSV/XLSX rows from Tasks 17–19 into durable customer transactions without silently double-counting repeated imports or silently dropping plausible repeated purchases.

Task 21 customer identity/grouping, cohorts, acquisition dates, and Observed LTV are explicitly out of scope.

## Duplicate identity

Duplicate detection is business-scoped and source-scoped.

1. If a non-empty Transaction ID exists, `business + source + Transaction ID` is a definitive duplicate key. The database enforces this with a unique index.
2. If Transaction ID is absent, `business + source + normalized email + transaction date + amount collected` is only a candidate signature. A matching signature is not treated as proof of duplication because a customer can make two legitimate same-value purchases.

For candidate collisions, the import pauses before the colliding row affects calculations. The user must explicitly choose either:

- `duplicate` — do not insert the candidate row; or
- `keep_distinct` — persist it as a legitimate separate transaction.

Every candidate decision is stored in `public.customer_transaction_duplicate_resolutions` with the resolver, time, source row, signature, match count, and an idempotent resolution token. This preserves an auditable decision and makes retrying the same decision safe.

Customer email is normalized with trim + lowercase. Transaction source is normalized with trim + lowercase. Transaction IDs are trimmed but remain case-sensitive.

## Persistence, concurrency, and security

- `public.customer_transactions` stores imported rows.
- `public.customer_transaction_duplicate_resolutions` stores audited fallback-collision decisions.
- Authenticated clients do not receive direct INSERT/UPDATE/DELETE privileges on either table.
- Imports and candidate decisions go through `public.import_customer_transactions(...)`.
- Only an admin or the business owner can execute an import for that business.
- RLS restricts reads of both transaction history and duplicate-resolution history to authorized business users/admins.
- A partial unique index enforces definitive Transaction ID duplicates at the database boundary.
- No unique index is used for the no-ID candidate signature; doing so would silently discard legitimate repeated purchases.
- No-ID candidate checking uses a transaction-scoped advisory lock so concurrent requests cannot both bypass the candidate check for the same signature.
- Resolution tokens are unique so a retry after an uncertain network result replays the previously stored decision instead of applying `keep_distinct` twice.

## Import behavior

- Validation must succeed before the UI enables import.
- Validation and preparation use Unicode character-count semantics that match PostgreSQL `char_length` for the email, source, and Transaction ID limits.
- Transaction ID length is validated before the UI reports `Validation ناجح`.
- A transaction source is required and must be reused consistently for exports from the same gateway.
- Rows are sent to the guarded RPC in chunks of at most 500.
- Definitive Transaction ID duplicates are skipped and counted explicitly.
- If a no-ID candidate collision is found, processing stops after the current chunk and the UI surfaces each collision for explicit resolution before continuing later chunks.
- File selection and mapping controls stay locked while an RPC is running or candidate decisions are pending so the import workflow cannot be unmounted mid-request.
- If a later request fails, the UI reports confirmed progress. Explicit candidate decisions carry retry-safe resolution tokens.

## Acceptance tests

The database-backed test matrix proves:

- repeated Transaction IDs are skipped as definitive duplicates;
- a no-ID same-signature row is surfaced as a candidate instead of being silently discarded;
- confirming a candidate as duplicate does not change aggregate cash;
- keeping a candidate distinct preserves a legitimate repeated same-value purchase;
- retrying a `keep_distinct` decision with the same resolution token does not insert it twice;
- aggregate cash/revenue does not double after a re-import is explicitly resolved as duplicate;
- candidate decisions are preserved exactly once in the audit table;
- candidate and definitive duplicate identity remain source-scoped;
- guarded RPC boundaries reject oversized source, Transaction ID, and email values plus a missing row number;
- direct authenticated inserts are blocked for transactions and resolution records;
- another business owner and a read-only member cannot import into the business;
- RLS prevents cross-business reads of transactions and resolution audit history;
- admins can import and inspect authorized records.

The Playwright verification covers the Arabic RTL browser flow, Transaction ID mapping, definitive duplicate counts, repeated-import feedback, and mobile containment. The database-backed SQL suite—not the browser mock—executes the actual guarded RPC and persistence rules against PostgreSQL in CI.
