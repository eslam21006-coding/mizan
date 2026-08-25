# Task 20 — Transaction Duplicate Protection

## Scope

Task 20 turns the validated CSV/XLSX rows from Tasks 17–19 into durable customer transactions without silently double-counting repeated imports or silently dropping plausible repeated purchases.

Task 21 customer identity/grouping, cohorts, acquisition dates, and Observed LTV are explicitly out of scope.

## Duplicate identity

Duplicate detection is business-scoped and uses a registered canonical transaction source.

1. If a non-empty Transaction ID exists, `business + source + Transaction ID` is a definitive duplicate key. The database enforces this with a unique index.
2. If Transaction ID is absent, `business + source + normalized email + transaction date + normalized amount + normalized transaction type` is only a candidate signature. A matching signature is not treated as proof of duplication because a customer can make two legitimate same-value purchases.
3. Candidate lookup includes existing rows whether or not those existing rows have a Transaction ID, so re-importing an ID-bearing transaction from an export that omits its ID cannot bypass duplicate review.

Collection and refund rows never collide solely because their email/date/amount/source values match; normalized transaction type is part of the candidate signature.

For candidate collisions, the import pauses before the colliding row affects calculations. The user must explicitly choose either:

- `duplicate` — do not insert the candidate row; or
- `keep_distinct` — persist it as a legitimate separate transaction.

Every candidate decision is stored in `public.customer_transaction_duplicate_resolutions` with the resolver, time, source row, signature, transaction type, match count, stable import-row identity, and an idempotent resolution token. This preserves an auditable decision and makes retrying the same decision safe.

Customer email is normalized with trim + lowercase. Transaction IDs are trimmed but remain case-sensitive.

## Canonical transaction sources

Transaction source is not accepted as arbitrary free text during import.

- Each business has a registry in `public.customer_transaction_sources`.
- An owner/admin explicitly creates a canonical source once, for example `stripe` or `paypal`.
- The browser then selects from registered sources for every import and re-import.
- The guarded import RPC rejects unregistered source labels.
- Source values use lowercase plus the same U+0020 space trimming rule as PostgreSQL `btrim`, so browser and RPC normalization stay identical.

This prevents an accidental label change such as `Stripe` versus `Stripe Export` from silently creating a second deduplication namespace. A new registered source should represent a genuinely different transaction system, not a spelling variant of an existing gateway.

## Transaction type and amount normalization

Every Task 20 import requires an explicit file-level normalized transaction type:

- `collection`; or
- `refund`.

Task 20 supports a file-level default because a source export may be known to contain only collections or only refunds. Mixed/ambiguous row classification remains outside this narrow Task 20 UI and must not be guessed.

- Collections must have positive amounts.
- Refund amounts are normalized to positive magnitudes before persistence.
- Refunds remain contra-revenue and must never be treated as expenses.

## Persistence, retry safety, concurrency, and security

- `public.customer_transactions` stores imported rows.
- `public.customer_transaction_sources` stores the business-scoped canonical source registry.
- `public.customer_transaction_duplicate_resolutions` stores audited candidate-collision decisions.
- Authenticated clients do not receive direct INSERT/UPDATE/DELETE privileges on any of these tables.
- Source creation goes through `public.create_customer_transaction_source(...)`.
- Imports and candidate decisions go through `public.import_customer_transactions(...)`.
- Only an admin or the business owner can create sources or execute an import for that business.
- RLS restricts reads of sources, transaction history, and duplicate-resolution history to authorized business users/admins.
- A partial unique index enforces definitive Transaction ID duplicates at the database boundary.
- Every prepared row receives a stable `import_row_token`. A retry after a committed-but-lost RPC response replays the original row result instead of creating a fresh candidate or a second transaction.
- No unique index is used for the no-ID candidate signature; doing so would silently discard legitimate repeated purchases.
- Candidate checking uses a transaction-scoped advisory lock derived from a scale-invariant numeric amount plus transaction type so concurrent `100` and `100.00` representations serialize to the same candidate identity.
- Resolution-token processing is also serialized, so concurrent retries with the same resolution token replay the stored decision rather than racing into a unique violation.

## Import behavior

- Validation must succeed before the UI enables import.
- Validation and preparation use Unicode character-count semantics that match PostgreSQL `char_length` for the email, source, and Transaction ID limits.
- Transaction ID length is validated before the UI reports `Validation ناجح`.
- A registered transaction source and an explicit transaction type are required before import.
- Rows are sent to the guarded RPC in chunks of at most 500.
- Definitive Transaction ID duplicates are skipped and counted explicitly.
- If a no-ID candidate collision is found, processing stops after the current chunk and the UI surfaces each collision for explicit resolution before continuing later chunks.
- File selection, mapping, source, and classification controls are disabled while an RPC is running or candidate decisions are pending. This does not claim to block unrelated application navigation.
- If candidate resolution succeeds but a later continuation request fails, the UI keeps the confirmed totals that existed before continuation as the retry base and intentionally replays the full continuation payload with the same stable `import_row_token` values. Already-committed continuation chunks therefore replay idempotently while the final counters remain cumulative, and committed candidate decisions are not resubmitted as fresh unresolved rows.
- If an import response is lost, retrying the same in-memory import uses the same per-row retry identities so already-committed rows are replayed rather than duplicated.

## Acceptance tests

The database-backed test matrix proves:

- repeated Transaction IDs are skipped as definitive duplicates;
- a no-ID same-signature row is surfaced as a candidate instead of being silently discarded;
- an existing ID-bearing transaction is still found when a later import omits that Transaction ID;
- collection and refund candidate signatures remain distinct;
- confirming a candidate as duplicate does not add a transaction row;
- keeping a candidate distinct preserves a legitimate repeated same-value purchase;
- retrying a `keep_distinct` decision with the same resolution token does not insert it twice;
- retrying an already-committed transaction row with the same `import_row_token` does not insert it twice;
- scale-equivalent amounts use one candidate identity;
- re-importing a candidate and explicitly resolving it as duplicate does not persist another transaction;
- candidate decisions are preserved exactly once in the audit table;
- canonical source registration is required before import;
- guarded RPC boundaries reject oversized source, Transaction ID, and email values plus a missing row number;
- direct authenticated inserts are blocked for sources, transactions, and resolution records;
- another business owner and a read-only member cannot create sources or import into the business;
- RLS prevents cross-business reads of sources, transactions, and resolution audit history;
- admins can create sources, import, and inspect authorized records.

The Playwright verification covers the Arabic RTL browser flow, canonical source selection/creation, transaction-type selection, Transaction ID mapping, duplicate-count rendering, repeated-import feedback, and mobile containment. The database-backed SQL suite—not the browser mock—executes the actual guarded RPC and persistence rules against PostgreSQL in CI.
