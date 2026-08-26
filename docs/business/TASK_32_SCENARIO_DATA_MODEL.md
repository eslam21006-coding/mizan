# Task 32 — Scenario Data Model

## Purpose

Task 32 creates the persistence boundary for Simulator scenarios without implementing Simulator calculations or controls.

A scenario is hypothetical data. It must never alter historical actual data.

The model therefore stores scenarios in dedicated tables with no foreign key, trigger, RPC, or write path into monthly actual tables.

## Tables

### `public.simulator_scenarios`

Stores scenario identity and lifecycle metadata:

- `id`
- `business_id`
- `name`
- `creation_request_id`
- `created_at`
- `updated_at`

Rules:

- Scenario names are trimmed and 1–120 characters.
- `creation_request_id` is required and unique per business so a repeated save request cannot silently create duplicate scenarios.
- `id`, `business_id`, `creation_request_id`, and `created_at` are immutable after creation.
- Renaming updates `updated_at`.
- Scenarios are isolated by business.
- Deleting a business may remove its hypothetical scenarios; scenarios are not historical actuals.

### `public.simulator_scenario_overrides`

Stores sparse scenario changes. A scenario does not need to copy every current business value. Only fields intentionally changed in the scenario need an override row.

Each row contains:

- `business_id`
- `scenario_id`
- `override_key`
- `override_value`
- `created_at`
- `updated_at`

A scenario can contain at most one value for each override key.

`business_id`, `scenario_id`, `override_key`, and `created_at` are immutable. The numeric override value may be edited.

## Allowed override keys

Task 32 permits exactly the Simulator controls already defined for Mizan V1:

1. `customer_value` — Customer value / price
2. `cpl` — CPL
3. `ad_spend` — Ad Spend
4. `show_rate` — Show Rate
5. `qualification_rate` — Qualification Rate
6. `close_rate` — Close Rate
7. `fixed_costs` — Fixed Costs
8. `variable_costs` — Variable Costs
9. `upsells` — Upsells
10. `renewals` — Renewals
11. `backend_revenue` — Backend Revenue

Unknown keys are rejected at the database level.

Task 32 does not invent calculation semantics for `upsells`, `renewals`, or other controls beyond storing their explicit numeric scenario input. Task 33 owns Simulator controls and calculation integration.

## Value constraints

All override values are exact database numerics with up to 8 decimal places and must be non-negative.

The three conversion-rate controls have an additional bound:

- `show_rate`
- `qualification_rate`
- `close_rate`

These must be between `0` and `1` inclusive.

Zero is intentionally allowed in the data model because a hypothetical scenario may represent a funnel stage collapsing to zero conversion. A later calculation that requires a positive denominator must fail closed rather than changing the saved scenario value.

## Scenario lifecycle

The data model supports the required saved-scenario lifecycle:

- **Save:** insert a new scenario identity and any sparse override rows.
- **Duplicate:** create a new scenario identity and copy the source scenario's override rows. The duplicate receives a new `id` and `creation_request_id`.
- **Rename:** update only the scenario name.
- **Delete:** delete the scenario; its override rows cascade with it.

Scenario names are not unique. A duplicate may initially use a copy-style name without colliding with the source scenario.

No public database RPC is added in Task 32. Task 33 may implement application actions using this model, but it must preserve these identity and authorization rules.

## Authorization / RLS

Both scenario tables have Row Level Security enabled.

Read access uses `private.can_read_business(business_id)`:

- Admin can read every business scenario.
- Business owner can read their scenarios.
- A member of the business can read its scenarios.
- Unrelated mentees cannot read them.

Write access uses `private.can_manage_business(business_id)`:

- Admin can save, edit, duplicate, rename, and delete scenarios.
- Business owner can save, edit, duplicate, rename, and delete scenarios for their business.
- Read-only business members cannot modify scenarios.
- Unrelated mentees cannot modify scenarios.
- Anonymous users have no table privileges.

The override table carries `business_id` and uses a composite foreign key to the scenario, preventing an override from being attached to a scenario under a different business.

## Historical actual isolation

Historical actuals currently live in separate tables including:

- `public.monthly_periods`
- `public.monthly_revenue_entries`
- `public.monthly_expense_entries`

Task 32 introduces no relationship from scenarios to those tables.

The database-backed Task 32 test creates a known monthly actual row, then performs scenario save, override editing, duplicate, rename, delete, cross-tenant authorization attempts, member read-only attempts, and admin operations. It finally asserts that every stored value and timestamp in the historical actual row is unchanged and that the historical row count is unchanged.

This locks the invariant:

> Scenario changes never alter historical actual data.

## Deliberately out of scope

Task 32 does not implement:

- Simulator form controls
- Scenario calculations
- Current vs Scenario comparison
- Target Planner integration
- Decision Engine integration
- scenario-derived financial results
- UI for save / duplicate / rename / delete
- new financial formulas

Those belong to subsequent tasks, beginning with Tasks 33 + 34 under the approved combined-PR exception.

## Acceptance criteria

1. Scenarios persist separately from historical actual data.
2. The model supports Save, Duplicate, Rename, and Delete semantics.
3. Exactly the 11 approved V1 override keys are accepted.
4. Override values are non-negative exact numerics; Show, Qualification, and Close Rates are additionally bounded to 0–100%.
5. Scenario identity cannot be moved between businesses after creation.
6. Override identity cannot be moved between scenarios/businesses or silently changed to another key.
7. Repeated creation requests are idempotency-protected per business.
8. RLS permits business-member reads while restricting writes to owner/admin management permissions.
9. Cross-tenant read/write attempts are denied.
10. Anonymous access is denied.
11. Deleting a scenario cascades only to its scenario override rows.
12. Database-backed tests prove scenario lifecycle operations do not mutate historical monthly actuals.
13. No Task 33 controls/calculation integration or Task 34 Current-vs-Scenario UI is included.
