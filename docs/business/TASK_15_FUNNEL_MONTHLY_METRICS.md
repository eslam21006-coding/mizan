# Task 15 — Funnel Monthly Metrics & Calculations

## Scope

Task 15 adds monthly performance tracking for the optional funnels introduced in Task 14.

Business-level economics remain primary. Funnel metrics are a drill-down and must never become a second copy of business revenue, expenses, or ad spend.

For each funnel and calendar month, Mizan may store:

- Ad Spend
- Leads
- Booked Calls
- Showed Calls
- Qualified Calls
- Sales
- New Customers
- Cash Collected
- Attributed Revenue

Task 15 also stores one optional business-level `Total Ad Spend` value for the month so Media CAC and MER have an explicit canonical ad-spend denominator.

## Missing versus zero

Missing and zero remain materially different:

- blank / `null` = unknown or unavailable;
- `0` = known and equal to zero.

The distinction is especially important for Attributed Revenue. Blank attribution must never be replaced with Cash Collected or total business revenue.

## Funnel calculations

For one funnel/month:

- `CPL = Ad Spend / Leads`
- `Cost Per Booking = Ad Spend / Booked Calls`
- `Cost Per Show = Ad Spend / Showed Calls`
- `Cost Per Qualified Call = Ad Spend / Qualified Calls`
- `Show Rate = Showed Calls / Booked Calls`
- `Qualification Rate = Qualified Calls / Showed Calls`
- `Close Rate = Sales / Qualified Calls`
- `Lead-to-Sale Rate = Sales / Leads`
- `Media CAC = Ad Spend / New Customers`
- `ROAS = Attributed Revenue / Ad Spend`

Every ratio/cost uses exact source values. If its denominator is zero, the metric is unavailable with a metric-specific reason. Mizan never returns `Infinity`, `NaN`, or a fabricated zero.

## Benchmarks

Only two funnel benchmarks are defined in V1:

- Show Rate is healthy only when `Show Rate > 65%`.
- Close Rate is healthy only when `Close Rate > 20%`.

The thresholds are strict. Exactly 65% Show Rate and exactly 20% Close Rate are not labelled healthy.

No universal health benchmark is invented for the other funnel metrics.

## ROAS attribution boundary

Attributed Revenue must represent actually collected cash with real attribution to the relevant funnel/ads.

- Funnel Cash Collected is not automatically Attributed Revenue.
- Total business revenue is not a substitute for funnel Attributed Revenue.
- Blank attribution produces `ATTRIBUTION_UNAVAILABLE`.
- If attribution exists but Ad Spend is zero, ROAS is unavailable with `NO_AD_SPEND`.
- Attributable refunds may make Attributed Revenue negative; negative funnel ROAS is therefore valid.

Task 15 does not create a business-level ROAS by summing funnel attributed revenue. Whole-business ROAS remains unavailable until real business-level attribution exists.

## Business/funnel ad-spend reconciliation

The same ad spend must never be counted twice.

Task 15 uses these rules:

1. If explicit business `Total Ad Spend` exists, it is the canonical business-level ad-spend value.
2. Otherwise, if every included funnel has a known Ad Spend value, their sum may roll up to the canonical business-level value.
3. If both explicit business Total Ad Spend and a complete funnel roll-up exist, Mizan compares them.
4. If they differ, the mismatch is surfaced; Mizan never adds the two values together.
5. If neither an explicit business total nor a complete funnel roll-up exists, canonical Ad Spend remains unavailable.

The explicit business Total Ad Spend and funnel Ad Spend values are KPI/reconciliation data. They do **not** create a second Acquisition expense. Actual ad cost must still be represented inside the business's Acquisition Costs to affect Real Net Profit, Acquisition CAC, Ultimate CAC, and All Business Costs.

With a canonical Ad Spend value, the business calculation engine may calculate:

- `Media CAC = canonical Total Ad Spend / business New Customers`
- `MER = business Net Cash Collected / canonical Total Ad Spend`

No ad-spend value is silently inferred from an expense item's name.

## Monthly history

Funnel monthly actuals are saved as monthly snapshots.

Each entry keeps immutable snapshots of:

- Funnel ID
- Funnel name
- Funnel type
- Business/month identity
- Creation timestamp

Renaming, reclassifying, or deactivating a funnel later does not rewrite prior month snapshots.

An inactive funnel cannot be added to a new month, but a historical month that already contains that funnel can still be corrected without replacing its historical snapshot.

Authenticated product access has no direct insert/update/delete privileges on the monthly funnel tables. Writes go through the validated security-definer save RPC.

## Permissions

Task 15 inherits the established business authorization boundary:

- Admin: read/manage all funnel months.
- Business owner: read/manage own-business funnel months.
- Business member: read-only.
- Unrelated Mentee: cannot read or modify another business's funnel months.
- Anonymous users: no table access and no save-RPC execution.

PostgreSQL RLS and RPC authorization are the security controls. UI visibility is only an affordance.

## Arabic RTL UX

The monthly funnel screen lives at:

`/businesses/[businessId]/funnels/monthly`

It provides:

- month selection;
- business Total Ad Spend;
- per-funnel monthly inputs;
- exact funnel KPIs;
- Show Rate / Close Rate benchmark status;
- ad-spend reconciliation status;
- read-only member mode;
- responsive Arabic RTL layout.

## Explicitly out of scope

Task 15 does not implement Task 16 self-liquidating funnel economics:

- Front-End Contribution Profit
- Ad Liquidation Rate
- Effective Remaining Ad Cost

It also does not implement:

- transaction import;
- Observed LTV/cohorts;
- Lifetime Contribution Profit;
- Decision Engine;
- Target Planner;
- Simulator;
- forecasting or AI recommendations.

## Verification requirements

Before merge:

1. Numerical tests must verify every funnel formula, denominator-zero behavior, strict benchmark boundaries, ROAS attribution behavior, negative attributed revenue, and ad-spend reconciliation.
2. Database tests must verify owner/Admin writes, business-member read-only behavior, cross-tenant denial, anonymous denial, missing-vs-zero persistence, inactive-funnel rules, and immutable historical snapshots.
3. Task 15 migration and database attack matrix must pass in normal CI.
4. The business dashboard must use the same canonical ad-spend reconciliation path for Media CAC and MER.
5. Authenticated browser verification must save funnel metrics, verify mismatch/matched reconciliation, strict benchmark behaviour, funnel ROAS, business Media CAC/MER, Arabic RTL, and 390px overflow.
6. Full CI must pass on the exact PR head.
7. CodeRabbit must have zero unresolved actionable comments.
8. Founder approval is required before merge.
