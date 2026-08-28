# Post-roadmap placeholder navigation cleanup

## Purpose

This cleanup converts the three remaining placeholder sidebar destinations into real product workflows before founder acceptance testing.

## Scope

### Monthly
- `/monthly` is now a business gateway into the existing monthly actual-entry workflow.
- Each business exposes current month, previous month, dashboard, and analytics links.
- No monthly financial formula or persistence behavior changes.

### Target Planner
- `/target-plan` now uses the existing deterministic Target Engine.
- Default assumptions come only from the last three complete months.
- Historical months are converted to the engine's existing assumption shape without double-counting media spend.
- Positive canonical media spend is separated only when exactly one fixed acquisition expense line has the same calculated amount; variable or ambiguous media representations fail closed instead of reclassifying another acquisition cost.
- Funnel counts must be non-negative safe integers, follow the funnel sequence, and reconcile to business new-customer counts.
- Missing, conflicting, unsafe, or unreconcilable data fails closed instead of creating a plan or returning an unhandled route error.
- The UI exposes the assumptions used, required financial outputs, reverse-engineered funnel volumes, and sustainable Acquisition CAC / Media CAC / CPL.
- Maximum Sustainable CAC remains explicitly Acquisition CAC and is never presented as Ultimate CAC.

### Settings
- `/settings` is now a business-configuration hub.
- It shows base currency/timezone and links to the existing revenue-stream, expense, funnel, customer, and monthly configuration workflows.
- V1 does not expose unsafe base-currency mutation after historical data exists.

## Verification

- Added known-input numerical tests for the Target Planner historical adapter.
- Added fail-closed tests for media-cost separation, variable-media ambiguity, unsafe funnel counts, and funnel/customer reconciliation.
- Added a deterministic source-contract test that fails if `/monthly`, `/target-plan`, or `/settings` regresses to the legacy `EmptyModule` placeholder or loses its required workflow bindings.
- Added a live authenticated Arabic RTL Playwright scenario for the three routes, including 390px horizontal-overflow checks. This scenario runs when dedicated E2E Supabase credentials are supplied; CI intentionally uses its isolated UI fixture and therefore does not claim live-route authentication.
- CI's fixture-mode Playwright suite continues to verify the shared Arabic RTL shell, mobile drawer, touch targets, focus behavior, and responsive containment without connecting to a production Supabase account.
- Full repository CI, production build, Vercel preview, review findings, and final authenticated founder/browser verification remain merge gates.

## Deliberately unchanged

- Core financial formulas and denominator rules.
- Target Engine formulas.
- Database schema, migrations, RLS, RPCs, or roles.
- Historical actual data.
- Simulator behavior.
- Admin/Mentee permission boundaries.
