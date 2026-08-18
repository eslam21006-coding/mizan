# Task 5 — Business Onboarding

## Scope

Task 5 lets an authenticated Mizan user create a business from zero with only the minimum business-level settings required before later setup tasks:

- business name;
- one V1 base currency;
- business timezone.

The authenticated user is always written as `owner_user_id` by the server action. The browser never chooses or submits an owner ID. Task 4 RLS remains the database authorization boundary.

## Explicitly deferred

The roadmap intentionally keeps these out of Task 5:

- revenue streams — Task 6;
- expense structure and cost behavior — Task 7;
- monthly data entry — Task 8;
- financial calculations — Task 9;
- funnels — Tasks 14–16.

The onboarding UI must not ask the user for those inputs early.

## Base currency

Supported V1 currencies remain exactly: USD, AED, SAR, EGP, KWD, QAR, JOD, EUR.

One base currency is stored per business. V1 does not perform silent FX conversion.

## Timezone

`businesses.timezone` stores a named timezone compatible with the database constraint and defaults to `Africa/Cairo` for backward-compatible inserts. The application first rejects unsupported identifier shapes such as fixed offsets (`+01:00`), then verifies the remaining value with the runtime timezone database.

The database limits the value to 64 characters and rejects malformed timezone-shaped strings. The check constraint is added `NOT VALID`; the following migration validates it separately. Timezone is setup metadata only in Task 5. Monthly period behavior is implemented later.

## Idempotent business creation

Live hosted browser verification exposed a real duplicate-delivery condition: one final onboarding action could reach the server more than once and create duplicate businesses. Task 5 therefore uses database-backed request idempotency rather than relying on button state.

### New requests must supply an explicit key

The server-rendered onboarding page generates a UUID `creation_request_id` and places it in the form. The server validates it before attempting the insert. The database intentionally has **no default** for this column after rollout, so a caller that omits the request ID fails instead of silently receiving a fresh UUID that would bypass idempotency.

The final submit button is also disabled after submission for immediate UX feedback, but database uniqueness is the correctness boundary.

### Safe rollout for existing businesses

The idempotency schema change is staged to avoid a volatile default rewrite and to minimize blocking on a populated table:

1. add nullable `creation_request_id uuid` with no default;
2. add a `NOT VALID` presence check;
3. backfill existing rows with `gen_random_uuid()`;
4. validate the presence check;
5. set the column `NOT NULL`;
6. build `(owner_user_id, creation_request_id)` using `CREATE UNIQUE INDEX CONCURRENTLY` so normal writes can continue during the index build;
7. attach the prebuilt index as the unique table constraint;
8. install the immutability trigger.

Database-backed CI creates a business before this rollout, applies the staged migrations, and proves that the pre-existing business is backfilled and the final constraint/index are valid.

### Replay behavior

- `(owner_user_id, creation_request_id)` is unique.
- `creation_request_id` is immutable after insert, preventing a client from changing its key and replaying an old request as a new one.
- A replay cannot create a second business.
- If a duplicate delivery loses the unique-key race, the server looks up the existing row using the authenticated owner + request ID and only treats it as success when the stored name, currency, and timezone match the original submitted payload.

## UX

The Arabic RTL onboarding flow is four short screens:

1. business name;
2. base currency;
3. timezone;
4. review and create.

Pressing Enter before the review step advances through the wizard rather than submitting incomplete hidden values to the server. Only the final review step submits the business creation action.

The business index lists every business visible through Task 4 RLS and provides the entry point to create another business. The home screen links directly to business setup.

## Verification

Task 5 is complete only when:

1. the migrations add and separately validate `businesses.timezone` without weakening Task 4 RLS;
2. server-side validation accepts only the approved currencies and a database-compatible real timezone;
3. the create action derives `owner_user_id` from the authenticated session rather than form input;
4. every new business insert requires an explicit server-generated creation request ID;
5. existing businesses survive the staged idempotency rollout and receive backfilled IDs;
6. duplicate delivery of one onboarding request results in exactly one business;
7. the creation request ID cannot be mutated after creation;
8. duplicate-recovery success requires the same owner and same submitted business payload;
9. database-backed tests prove a Mentee cannot create a business owned by another user;
10. the owner membership is still created automatically by the Task 4 trigger;
11. the Arabic RTL wizard works on desktop and mobile without console/runtime errors;
12. the business appears exactly once after successful creation;
13. CI, CodeRabbit, and live Supabase/browser verification are green before merge.
