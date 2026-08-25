# Task 20 — Transaction Duplicate Protection

## Scope

Task 20 turns the validated CSV/XLSX rows from Tasks 17–19 into durable customer transactions without silently double-counting repeated imports or silently dropping plausible repeated purchases.

Task 21 customer identity/grouping is implemented as the approved paired extension in the same PR, but keeps separate acceptance criteria and tests.

## Accepted transaction semantics

Mizan persists only rows that are explicitly normalized as:

- `normalized_outcome = successful`; and
- `normalized_transaction_type = collection` or `refund`.

The Task 20 browser flow supports an import-level outcome default only when the export is known to contain successful transactions only. The user must explicitly confirm that condition before import. Failed, pending, cancelled, or mixed-status exports must be filtered/split first rather than guessed.

Collections must have positive amounts. Refunds are normalized to positive magnitudes, remain contra-revenue, and are never treated as expenses.

## Currency rule

The business base currency is the only accepted currency in V1.

- If a Currency column exists, it can be mapped and every row is validated against the business base currency.
- If no Currency column exists, the user must explicitly confirm that the source file uses the business base currency before import.
- Every persisted transaction stores the normalized business currency.
- The guarded RPC rejects currency values that differ from `businesses.base_currency`.
- No silent FX conversion exists.

## Timestamp and reporting-timezone rule

The original trimmed ISO source date/time string is preserved in `source_transaction_at`.

The guarded RPC converts it to canonical `transaction_at timestamptz` using the business reporting timezone from `businesses.timezone`:

- date-only values are interpreted as that calendar date in the business timezone;
- datetime values with `Z` or an explicit offset represent that instant directly;
- datetime values without an offset are interpreted as local time in the business timezone.

`transaction_date` is the resulting calendar date in the business reporting timezone. Candidate duplicate identity uses canonical `transaction_at`, so equivalent offset representations resolve to the same instant while the original source text remains available for audit.

## Duplicate identity

Duplicate detection is business-scoped and uses a registered canonical transaction source.

1. If a non-empty Transaction ID exists, `business + source + Transaction ID` is a definitive duplicate key. The database enforces this with a unique index.
2. If Transaction ID is absent, `business + source + normalized email + canonical transaction_at + normalized amount + normalized transaction type` is only a candidate signature. A matching signature is not proof of duplication because a customer can make two legitimate same-value purchases.
3. Candidate lookup includes existing rows whether or not those existing rows have a Transaction ID, so re-importing an ID-bearing transaction from an export that omits its ID cannot bypass duplicate review.

Collection and refund rows never collide solely because email/time/amount/source values match; normalized transaction type is part of the candidate signature.

For candidate collisions, the import pauses before the colliding row affects calculations. The user must explicitly choose either:

- `duplicate` — do not insert the candidate row; or
- `keep_distinct` — persist it as a legitimate separate transaction.

Every candidate decision is stored in `public.customer_transaction_duplicate_resolutions` with the resolver, source timestamp, canonical instant, currency, normalized outcome, source row, signature values, match count, stable import-row identity, and an idempotent resolution token.

Customer email is normalized with trim + lowercase. Transaction IDs are trimmed but remain case-sensitive.

## Canonical transaction sources

Transaction source is not accepted as arbitrary free text during import.

- Each business has a registry in `public.customer_transaction_sources`.
- An owner/admin explicitly creates a canonical source once, for example `stripe` or `paypal`.
- The browser then selects from registered sources for every import and re-import.
- The guarded import RPC rejects unregistered source labels.
- Source values use lowercase plus the same U+0020-space trimming rule as PostgreSQL `btrim`.

## Persistence, retry safety, concurrency, and security

- `public.customer_transactions` stores imported successful rows, original source date/time, canonical instant, reporting date, currency, and normalized type/outcome.
- `public.customer_transaction_sources` stores the business-scoped canonical source registry.
- `public.customer_transaction_duplicate_resolutions` stores audited candidate-collision decisions.
- Authenticated clients do not receive direct INSERT/UPDATE/DELETE privileges on these tables.
- Source creation goes through `public.create_customer_transaction_source(...)`.
- Imports and candidate decisions go through `public.import_customer_transactions(...)`.
- Only an admin or the business owner can create sources or execute an import for that business.
- RLS restricts reads of sources, transaction history, and duplicate-resolution history to authorized business users/admins.
- A partial unique index enforces definitive Transaction ID duplicates at the database boundary.
- Every prepared row receives a stable `import_row_token`. A retry after a committed-but-lost RPC response replays the original row result instead of creating a fresh candidate or a second transaction.
- No unique index is used for the no-ID candidate signature; doing so would silently discard legitimate repeated purchases.
- Candidate checking uses a transaction-scoped advisory lock derived from the canonical instant, scale-invariant amount, source, email, and transaction type.
- Resolution-token processing is serialized, so concurrent retries with the same resolution token replay the stored decision rather than racing into a unique violation.

## Import behavior

- Validation must succeed before the UI enables import.
- Transaction ID length is validated before the UI reports `Validation ناجح`.
- A registered transaction source, successful-only confirmation, base-currency mapping/confirmation, and explicit transaction type are required before import.
- Rows are sent to the guarded RPC in chunks of at most 500.
- Definitive Transaction ID duplicates are skipped and counted explicitly.
- If a no-ID candidate collision is found, processing stops after the current chunk and the UI surfaces each collision for explicit resolution before continuing later chunks.
- File selection, mapping, source, and classification controls are disabled while an RPC is running or candidate decisions are pending. This does not claim to block unrelated application navigation.
- If candidate resolution succeeds but a later continuation request fails, the UI keeps the confirmed totals that existed before continuation as the retry base and intentionally replays the full continuation payload with the same stable `import_row_token` values. Already-committed continuation chunks therefore replay idempotently while final counters remain cumulative.
- If an import response is lost, retrying the same in-memory import uses the same per-row retry identities so already-committed rows are replayed rather than duplicated.

## Acceptance tests

The database-backed test matrix proves the existing definitive/candidate duplicate behavior and additionally proves:

- existing Task 20 date-only rows survive the semantic hardening migration;
- original source timestamp/offset is preserved;
- canonical `transaction_at` is derived correctly;
- business reporting date respects `businesses.timezone`;
- equivalent offset representations share one candidate identity;
- date-only input remains the intended local business calendar date;
- a non-successful normalized outcome is rejected;
- a currency different from the business base currency is rejected;
- direct authenticated writes and unauthorized cross-business access remain blocked.

Unit tests prove mapped-currency validation, absent-currency import-level confirmation compatibility, exact source datetime preservation, explicit successful/base-currency metadata, and invalid time-component rejection.

The Playwright verification covers the Arabic RTL browser flow, canonical source creation/selection, successful-only confirmation, Currency mapping, transaction-type selection, Transaction ID mapping, duplicate-count rendering, repeated-import feedback, and mobile containment. The database-backed SQL suite—not the browser RPC mock—executes the actual guarded RPC and persistence rules against PostgreSQL in CI.
