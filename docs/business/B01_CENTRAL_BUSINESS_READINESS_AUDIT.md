# B01-A — Central Business Readiness Audit

## Scope

B01-A is discovery plus the typed readiness contract only.

It does not implement readiness resolution, change the current Overview, add persistence, change financial logic, or add visible UX.

## Existing source-of-truth map

| Readiness area | Current authoritative source / implementation | B01 decision |
| --- | --- | --- |
| Business identity | Authorized `businesses` row loaded by `src/app/(app)/businesses/[businessId]/page.tsx` | Treat the existing valid/authorized business record as the identity source. Do not impose future B05 creation rules on legacy businesses. |
| Revenue setup | Active `revenue_streams` rows loaded by Business Overview; current `resolveBusinessOverviewHealth()` treats count > 0 as ready | Reuse the active revenue-stream model. No new revenue model. |
| Expense setup | Active `expense_items` rows loaded by Business Overview; current Overview treats count > 0 as ready | Preserve this only as legacy Overview compatibility. It is not sufficient for canonical readiness because zero expenses may be an explicit reviewed answer. B02 will add the persisted review signal. |
| First month / history | `monthly_periods` rows; current Overview queries the current month and latest saved month | Reuse existing Monthly persistence. B01-B must not invent a second financial-completeness model. |
| Customers | `customer_history_overview`, `customer_economics_review_exceptions`, `customer_economics_missing_period_exceptions`, and the transaction-import completion summary | Map these existing sources into no-transactions / imported / needs-review / ready without changing transaction, cohort, or customer-economics calculations. |
| Sales | `funnels` for configuration plus `loadFunnelMonth()` for monthly funnel periods/entries | No funnel remains a valid optional state; it must never block Core Setup. |
| Simulator | `loadSimulatorMonth()` and its existing `SimulatorMonthBlocker` states | Readiness must reuse these blockers/prerequisites rather than invoke or duplicate scenario calculations. |
| Target Planner | Rolling 3 complete months loaded through `loadDashboardMonth()` + `loadFunnelMonth()`, then `buildTargetPlannerActualMonth()` and `resolveRolling3TargetAssumptions()` | Readiness must reuse these existing prerequisites/blockers. |

## Current Overview compatibility

The existing `src/lib/business-overview.ts` resolver currently owns:

- revenue source readiness;
- expense item readiness;
- current-month saved state;
- latest saved month;
- a UI-facing next action;
- fail-closed `dataLoadError` behavior.

B01-B must move canonical readiness rules into the central resolver and leave `resolveBusinessOverviewHealth()` as either the evolved entry point or a thin compatibility adapter. There must not be two independent rule sets.

The central contract deliberately does not include labels, hrefs, Arabic copy, or `canManage`. Those remain presentation/navigation concerns.

## Load failures are not missing setup

Current Overview fails closed when readiness data cannot be loaded. The central contract therefore includes `loadState: "loaded" | "load_error"` at domain/capability level.

A load error must never be silently converted into:

- zero revenue sources;
- zero expenses;
- zero months;
- no transactions;
- no funnel;
- planning not configured.

## Missing is not zero

The contract exports `ReadinessValueState` with four distinct states:

- `unknown`;
- `explicit_zero_or_none`;
- `not_applicable`;
- `present`.

This is structural support for the Simplification V2 invariant that unanswered data, an explicit zero/none answer, and not-applicable are different states.

For expenses specifically, B01 uses:

- `reviewed`;
- `not_reviewed`;
- `unknown`.

B02 is responsible for persisting the explicit review confirmation.

## Planning prerequisites observed in the repository

### Simulator

`loadSimulatorMonth()` already fails closed for:

- month not saved;
- month data unavailable;
- invalid monthly calculation;
- unavailable Net Cash;
- unavailable total costs;
- unavailable variable costs;
- unavailable new customers;
- zero new customers;
- unavailable/reconciliation-failed Ad Spend;
- internally inconsistent scenario baseline.

Funnel baseline is optional for the Simulator engine itself; when a safe funnel baseline cannot be derived, the engine can still expose a financial scenario baseline.

### Target Planner

The current Target Planner requires three complete historical months and validates each month through:

- dashboard/core actuals;
- expense actuals;
- canonical Ad Spend;
- funnel monthly data;
- funnel/new-customer consistency;
- valid funnel sequence;
- Rolling-3 assumption resolution.

B01-B should translate these existing blockers into the central machine-readable planning requirements rather than create new financial/planning rules.

## Contract location

The central B01 type contract lives in:

`src/lib/business/readiness.ts`

It represents:

- Core Setup;
- History;
- Customers;
- Sales;
- Planning.

There is intentionally no global `businessReady` boolean because optional progressive capabilities must not block Core Setup.

## Deferred to B01-B

B01-A does not yet:

- resolve any readiness state;
- query the database;
- modify `resolveBusinessOverviewHealth()`;
- change Overview behavior;
- add known-input readiness tests;
- change schema/RLS;
- write any readiness state.

Those are implementation tasks for the resolver/compatibility work that follows.
