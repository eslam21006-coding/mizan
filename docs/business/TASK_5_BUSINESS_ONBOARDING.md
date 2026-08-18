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

`businesses.timezone` stores an IANA timezone name and defaults to `Africa/Cairo` for backward-compatible inserts. The application validates submitted values using the runtime timezone database. The database also rejects malformed timezone-shaped strings and limits the value to 64 characters.

Timezone is setup metadata only in Task 5. Monthly period behavior is implemented later.

## UX

The Arabic RTL onboarding flow is four short screens:

1. business name;
2. base currency;
3. timezone;
4. review and create.

The business index lists every business visible through Task 4 RLS and provides the entry point to create another business. The home screen links directly to business setup.

## Verification

Task 5 is complete only when:

1. the migration adds `businesses.timezone` without weakening Task 4 RLS;
2. server-side validation accepts only the approved currencies and a real timezone;
3. the create action derives `owner_user_id` from the authenticated session rather than form input;
4. database-backed tests prove a Mentee cannot create a business owned by another user;
5. the owner membership is still created automatically by the Task 4 trigger;
6. the Arabic RTL wizard works on desktop and mobile without console/runtime errors;
7. the business appears after successful creation;
8. CI, CodeRabbit, and live Supabase/browser verification are green before merge.
