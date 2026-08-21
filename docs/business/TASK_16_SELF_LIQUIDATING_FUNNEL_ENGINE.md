# Task 16 — Self-Liquidating Funnel Engine

## Scope

Task 16 implements the locked Calculation Spec §12 self-liquidation formulas at the **business-month Front-End level**.

It does not fabricate per-funnel revenue or cost attribution. Mizan currently has funnel-level Ad Spend and business revenue streams, but no authoritative mapping from an individual funnel to revenue streams or expense allocations. Until that mapping exists, a per-funnel liquidation percentage would be false precision.

## Revenue stream classification

Revenue streams support:

- Front-End
- Backend
- Other

Only Front-End streams participate in Front-End Net Cash.

Backend and Other revenue remain part of normal business economics but are excluded from self-liquidation calculations.

## Front-End Net Cash

`Front-End Net Cash = Front-End Gross Cash - Front-End Refunds`

The engine sums all monthly revenue-stream snapshots tagged Front-End.

If a Front-End stream has missing Gross Cash or Refunds, exact Front-End Net Cash is unavailable. Missing values are never treated as zero.

If the business has no Front-End streams in the selected month, Front-End Net Cash is exactly zero.

## Front-End variable costs

Only variable expense behaviors can participate:

- Per Customer
- Percentage of Revenue

Fixed Monthly expenses are excluded.

Task 16 stores a separate monthly `allocated_amount` for each variable monthly expense entry. This allocation is explicitly the part of the already-calculated variable expense attributable to Front-End economics.

Rules:

- `0` = explicitly known that none of the expense belongs to Front-End.
- missing allocation = attribution/allocation is unknown.
- an allocation cannot be negative.
- an allocation cannot exceed the actual calculated monthly expense amount.
- an allocation cannot be entered when the underlying expense amount itself is unavailable.
- changing an expense's current name later does not rewrite historical allocation snapshots.

For a positive material variable expense, a missing Front-End allocation makes exact Front-End Variable Costs unavailable.

A zero-value variable expense does not require a fabricated allocation row.

## Front-End Contribution Profit

`Front-End Contribution Profit = Front-End Net Cash - Front-End Variable Costs`

The result is exact only when both components are exact.

## Canonical Ad Spend

Task 16 reuses Task 15's canonical Total Ad Spend reconciliation.

Business and funnel spend are never added together.

If canonical Ad Spend is unavailable, Mizan may still show exact Front-End Net Cash and Front-End Contribution Profit, but Ad Liquidation Rate and Effective Remaining Ad Cost are unavailable where the formula requires Ad Spend.

## Ad Liquidation Rate

`Ad Liquidation Rate = Front-End Contribution Profit / Ad Spend`

Rules:

- Ad Spend > 0: calculate exactly.
- Ad Spend = 0: unavailable with `NO_AD_SPEND`.
- values above 100% are valid and must not be capped.

## Effective Remaining Ad Cost

`Effective Remaining Ad Cost = Ad Spend - Front-End Contribution Profit`

Negative values are valid and mean Front-End Contribution Profit exceeded Ad Spend.

Unlike the liquidation rate, Effective Remaining Ad Cost can still be calculated when known Ad Spend is zero.

## Security

Front-End allocations are stored in `public.monthly_front_end_expense_allocations`.

- RLS enabled.
- Authenticated clients receive SELECT only.
- Writes go through `public.save_front_end_expense_allocations`.
- Admin: read/manage all.
- Business owner: read/manage own business.
- Business member: read-only.
- Unrelated Mentee: no read/write access.
- Anonymous: no table access and no RPC execution.

Allocation identity and historical snapshots are immutable.

## UI

The business-month page lives at:

`/businesses/[businessId]/liquidation`

It shows:

- Front-End Net Cash
- Front-End Variable Costs
- Front-End Contribution Profit
- Ad Liquidation Rate
- Effective Remaining Ad Cost
- Canonical Total Ad Spend
- Front-End revenue rows used by the calculation
- explicit Front-End allocation inputs for variable expenses

The page clearly states that the result is business-level Front-End economics, not a fabricated individual-funnel result.

## Verification requirements

Before merge:

1. Known-input numerical tests for Front-End Net Cash, allocated costs, Contribution Profit, >100% liquidation, and negative Effective Remaining Ad Cost.
2. Missing Front-End revenue and missing variable-cost allocation must fail closed.
3. Zero Ad Spend must make Ad Liquidation Rate unavailable without breaking Effective Remaining Ad Cost.
4. Database tests must cover owner/Admin/member/cross-tenant/anonymous access, allocation limits, fixed-cost rejection, missing-vs-zero, `Other` stream snapshots, and immutable history.
5. Authenticated Arabic RTL browser verification must exercise a >100% liquidation scenario and 390px responsive layout.
6. Full exact-head CI and production build must pass.
7. CodeRabbit must have zero unresolved actionable comments.
8. Founder approval is required before merge.
