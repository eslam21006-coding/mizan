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
- Canonical media spend is separated from fixed acquisition costs before the existing engine calculates required Ad Spend.
- Funnel counts must reconcile to business new-customer counts.
- Missing, conflicting, or unreconcilable data fails closed instead of creating a plan.
- The UI exposes the assumptions used, required financial outputs, reverse-engineered funnel volumes, and sustainable Acquisition CAC / Media CAC / CPL.
- Maximum Sustainable CAC remains explicitly Acquisition CAC and is never presented as Ultimate CAC.

### Settings
- `/settings` is now a business-configuration hub.
- It shows base currency/timezone and links to the existing revenue-stream, expense, funnel, customer, and monthly configuration workflows.
- V1 does not expose unsafe base-currency mutation after historical data exists.

## Verification

- Added known-input numerical tests for the Target Planner historical adapter.
- Added fail-closed tests for media-cost separation and funnel/customer reconciliation.
- Added authenticated Arabic RTL browser coverage proving the three routes no longer render placeholder copy and do not create 390px horizontal overflow.
- Full repository CI, production build, browser verification, Vercel preview, and review findings remain merge gates.

## Deliberately unchanged

- Core financial formulas and denominator rules.
- Target Engine formulas.
- Database schema, migrations, RLS, RPCs, or roles.
- Historical actual data.
- Simulator behavior.
- Admin/Mentee permission boundaries.
