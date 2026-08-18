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

Supported V1 currencies remain exactly:

- USD
- AED
- SAR
- EGP
- KWD
- QAR
- JOD
- EUR

One base currency is stored per business. V1 does not perform silent FX conversion.

## Timezone

`businesses.timezone` stores a named timezone compatible with the database constraint and defaults to `Africa/Cairo` for backward-compatible inserts. The application first rejects unsupported identifier shapes such as fixed offsets (`+01:00`), then verifies the remaining value with the runtime timezone database.

The database limits the value to 64 characters and rejects malformed timezone-shaped strings. The check constraint is added `NOT VALID` so introducing it does not scan existing rows while holding the stronger DDL lock; the immediately following migration validates the constraint separately. Database-backed tests assert the final constraint is validated.

Timezone is setup metadata only in Task 5. Monthly period behavior is implemented later.

## Idempotent business creation

Live browser verification exposed that the same final onboarding submission can be delivered more than once. Business creation therefore has a database-backed idempotency key rather than relying only on UI button state.

- The server-rendered onboarding page generates a UUID `creation_request_id` for the form.
- `businesses` stores that internal request ID.
- `(owner_user_id, creation_request_id)` is unique.
- `creation_request_id` is immutable after insert, preventing a client from changing the key and replaying an old request to create a duplicate.
- A replay of the same creation request cannot create a second business.
- If the duplicate request loses the unique-key race, the server verifies the already-created business belongs to the same authenticated owner **and** has the same name, currency, and timezone before treating the replay as successful.
- The final submit button is also disabled after submission for immediate UX feedback, but database uniqueness and immutability are the correctness boundary.

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
4. duplicate delivery of one onboarding request results in exactly one business;
5. the creation request ID cannot be mutated after creation;
6. duplicate-recovery success requires the same owner and same submitted business payload;
7. database-backed tests prove a Mentee cannot create a business owned by another user;
8. the owner membership is still created automatically by the Task 4 trigger;
9. the Arabic RTL wizard works on desktop and mobile without console/runtime errors;
10. the business appears exactly once after successful creation;
11. CI, CodeRabbit, and live Supabase/browser verification are green before merge.
