# B01 — Central Business Readiness Audit

## Delivered scope

B01 now includes:

- the repository/source-of-truth audit;
- the typed central readiness contract;
- deterministic read-only readiness resolvers;
- planning blocker-to-requirement mappings;
- the existing Overview compatibility adapter;
- known-input readiness tests;
- regression coverage preserving current Overview behavior.

B01 does not add persistence, change financial logic, change RLS, mutate historical data, or introduce a visible UX redesign.

## Existing source-of-truth map

| Readiness area | Current authoritative source / implementation | B01 decision |
| --- | --- | --- |
| Business identity | Authorized `businesses` row loaded by `src/app/(app)/businesses/[businessId]/page.tsx` | Treat the existing valid/authorized business record as the identity source. Do not impose future B05 creation rules on legacy businesses. |
| Revenue setup | Active `revenue_streams` rows loaded by Business Overview | Reuse the active revenue-stream model. The central Core resolver owns the count > 0 readiness predicate. |
| Expense setup | Active `expense_items` rows loaded by Business Overview | Preserve count > 0 only as temporary legacy Overview compatibility. It is not canonical V2 expense readiness because zero expenses may be an explicit reviewed answer. B02 adds the persisted review signal. |
| First month / history | `monthly_periods` rows; current Overview queries the current month and latest saved month | Reuse existing Monthly persistence. The central resolver consumes valid-month facts and does not create a second calculation engine. |
| Customers | `customer_history_overview`, `customer_economics_review_exceptions`, `customer_economics_missing_period_exceptions`, and transaction/import state | Map these existing facts into no-transactions / imported / needs-review / ready without changing transaction, cohort, or customer-economics calculations. |
| Sales | `funnels` for configuration plus `loadFunnelMonth()` for monthly funnel periods/entries | No funnel remains a valid optional state; it never blocks Core Setup. |
| Simulator | `loadSimulatorMonth()` and its existing `SimulatorMonthBlocker` states | Translate existing blockers to readiness requirements rather than invoke or duplicate scenario calculations. |
| Target Planner | Rolling 3 complete months loaded through `loadDashboardMonth()` + `loadFunnelMonth()`, then `buildTargetPlannerActualMonth()` and `resolveRolling3TargetAssumptions()` | Translate existing blockers/prerequisites to readiness requirements rather than create new planning rules. |

## Central contract and resolver

The central implementation lives in:

`src/lib/business/readiness.ts`

It represents:

- Core Setup;
- History;
- Customers;
- Sales;
- Planning.

The file exports a deterministic `resolveBusinessReadiness()` plus domain resolvers for Core, History, Customers, Sales, and Planning capabilities.

The resolver is pure/read-only. It consumes already-authoritative facts and prerequisite results; it does not query or write the database and does not recalculate financial metrics.

There is intentionally no global `businessReady` boolean because optional progressive capabilities must not block Core Setup.

## Current Overview compatibility

`src/lib/business-overview.ts` now delegates setup predicates to `resolveCoreSetupReadiness()`.

The legacy Overview contract still owns presentation/navigation concerns:

- current-month saved state;
- latest saved month;
- UI-facing next action;
- Arabic action labels;
- read-only wording;
- fail-closed `dataLoadError` response shape.

Until B02 persists explicit expense-review completion, the Overview adapter translates its existing legacy heuristic:

`expenseItemCount > 0`

into a temporary `reviewed` / `not_reviewed` input for central Core readiness.

That compatibility translation exists only to preserve current production behavior. It is not the canonical V2 definition of expense setup.

## Load failures are not missing setup

Current Overview fails closed when readiness data cannot be loaded. The central contract therefore includes:

`loadState: "loaded" | "load_error"`

at domain/capability level.

A load error must never be interpreted as a known zero/none business state. Consumers must inspect `loadState` before treating status values as authoritative.

## Missing is not zero

The contract exports `ReadinessValueState` with four distinct states:

- `unknown`;
- `explicit_zero_or_none`;
- `not_applicable`;
- `present`.

This supports the Simplification V2 invariant that unanswered data, an explicit zero/none answer, and not-applicable are different states.

For expenses specifically, B01 represents:

- `reviewed`;
- `not_reviewed`;
- `unknown`.

B02 is responsible for persisting the explicit review confirmation, including the valid case where the business has no expenses.

## History behavior

History preserves both:

- exact valid-month count;
- a bounded readiness level: none / one_month / two_months / three_plus.

Core Setup uses the same valid-month fact to determine whether at least one valid month exists.

## Customer behavior

The central resolver maps authoritative customer facts into:

- `no_transactions`;
- `imported`;
- `needs_review`;
- `ready`.

Review issues take precedence over analysis-ready state, and transaction absence remains distinct from a load failure.

## Sales behavior

The central resolver maps authoritative funnel facts into:

- `no_funnel`;
- `funnel_configured`;
- `monthly_data_ready`.

No funnel is a normal optional state and never makes Core Setup incomplete.

## Planning prerequisites

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

B01 translates those blocker states into central machine-readable planning requirements.

Funnel baseline is optional for the Simulator engine itself; when a safe funnel baseline cannot be derived, the engine may still expose a financial scenario baseline.

### Target Planner

The current Target Planner requires three complete historical months and validates each month through:

- dashboard/core actuals;
- expense actuals;
- canonical Ad Spend;
- funnel monthly data;
- funnel/new-customer consistency;
- valid funnel sequence;
- Rolling-3 assumption resolution.

B01 translates the existing Target Planner month blockers into central planning requirements. It does not change Target Planner calculations.

## Verification coverage

`test/business/business-readiness.test.mts` covers:

- explicit reviewed-none versus unknown expense setup;
- deterministic Core missing requirements;
- 0 / 1 / 2 / 3+ history levels while retaining exact count;
- all four Customer states;
- all three Sales states;
- optional Sales/Customers/Planning not blocking Core;
- Simulator and Target Planner blocker mappings;
- load errors failing closed;
- invalid loaded counts being rejected;
- deterministic repeated resolution;
- Overview delegation to central Core readiness.

The existing `test/business/business-overview.test.mts` continues to verify current Overview behavior and destinations.

## Deferred beyond B01

B01 intentionally does not:

- persist expense-setup review confirmation — B02;
- derive compatibility status for all existing businesses — B03;
- create the setup wizard — B04 onward;
- change schema/RLS;
- change any financial definition or formula;
- change transaction, funnel, Simulator, or Target Planner engines;
- add visible readiness UX.

These remain separate roadmap batches.
