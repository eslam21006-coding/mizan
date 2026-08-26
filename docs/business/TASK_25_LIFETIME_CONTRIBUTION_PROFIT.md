# Task 25 — Lifetime Contribution Profit

## Product term

Use **Lifetime Contribution Profit**. Do not use LTGP.

## Formula

At cohort scope:

`Lifetime Contribution Profit = Lifetime Net Cash - Attributable/Allocated Acquisition Costs - Customer-Linked Variable Fulfillment Costs - Other Customer-Linked Variable Costs - Allocable Payment Processing Costs`

Task 25 also exposes the result per original cohort customer by dividing the cohort result by Original Cohort Size.

## Cost attribution model

V1 supports only two explicit methods:

1. `direct_actual` — directly attributable actual cost.
2. `explicit_allocation` — a user-provided allocation.

Task 25 does **not** invent a deterministic estimated allocation. If future product work defines an estimate, it must be separately reviewed and labeled as an estimate.

For a cohort to produce Lifetime Contribution Profit, all four supported cost categories must be explicitly supplied, including zero where the user confirms no cost exists.

If any category is missing, the metric is unavailable rather than guessed.

## Fixed overhead exclusion

Fixed overhead is structurally excluded. The allocation table has no `overhead` cost type, so general overhead cannot silently enter Lifetime Contribution Profit.

## Storage

`public.customer_cohort_cost_allocations` stores business/cohort/cost-type amount, attribution method, optional note, and audit user/timestamps.

Direct writes are not granted to authenticated clients. Owners/admins write through `public.save_customer_cohort_cost_allocations`.

## View

`public.customer_lifetime_contribution_profit` joins the current Observed LTV cohort snapshot to explicit cost allocations and exposes:

- Lifetime Net Cash
- four included cost categories
- allocation completeness
- whether any explicit allocation was used
- cohort Lifetime Contribution Profit
- Lifetime Contribution Profit per original customer
- exact text values
- currency and observation cutoff

## Acceptance criteria

- Example K returns 5,700 from 10,000 Net Cash and 2,500 + 1,000 + 500 + 300 included costs.
- Fixed overhead cannot be inserted into the metric.
- Missing attribution leaves the metric unavailable.
- Explicit allocation is disclosed.
- Owner/admin write authorization is enforced at database level.
- Authorized readers can read; cross-business and anonymous access are blocked.
- Numerical tests use known inputs/outputs.
- Arabic RTL UI explains included/excluded costs and lets the owner/admin save explicit cohort allocations.
