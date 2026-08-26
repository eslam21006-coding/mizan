# Task 29 — Target Engine

## Scope

Task 29 adds the deterministic monthly Target Engine used by Mizan's Target Planner.

Supported targets:

- Revenue
- Real Net Profit
- Real Net Profit Margin

The engine reverse-engineers:

- Required Revenue
- Required New Customers
- Required Sales
- Required Qualified Calls
- Required Shows
- Required Bookings
- Required Leads
- Required Ad Spend
- Maximum Sustainable Acquisition CAC
- Maximum Media CAC where calculable
- Maximum CPL where calculable
- Projected Real Net Profit
- Projected Real Net Profit Margin

Task 29 is calculation logic only. UI, persistence, simulator behavior, and historical mutation are out of scope.

## Default assumptions

When enough data exists, the default assumption source is **Rolling 3 Months actual performance**.

Task 29 never hides assumptions. Every ready plan returns the complete assumption object and its source.

Rolling 3 Month defaults require exactly three consecutive **complete** calendar months ending at an explicit `lastCompleteMonth` supplied by the caller. The resolver does not infer completeness from the current clock. This keeps the calculation deterministic and prevents a current, incomplete, or future month from being treated as historical actual performance.

Before any aggregation, the resolver verifies that:

- exactly three months were supplied,
- the months are consecutive,
- no supplied month is after `lastCompleteMonth`, and
- the newest supplied month is exactly `lastCompleteMonth`.

The resolver then aggregates the three actual months and derives:

- Revenue Per New Customer = total Net Cash Collected / total New Customers
- Assumed Media CAC = total Ad Spend / total New Customers
- Monthly Fixed Acquisition Costs = three-month fixed acquisition costs / 3
- Monthly Fixed Non-Acquisition Costs = three-month fixed non-acquisition costs / 3
- Variable Non-Media Acquisition Cost Per New Customer = three-month variable non-media acquisition costs / total New Customers
- Variable Non-Acquisition Cost Per New Customer = three-month variable non-acquisition costs / total New Customers
- Booking Rate = total Bookings / total Leads
- Show Rate = total Shows / total Bookings
- Qualification Rate = total Qualified Calls / total Shows
- Close Rate = total Sales / total Qualified Calls
- Sale-to-New-Customer Rate = total New Customers / total Sales

The engine uses Net Cash Collected, not Gross Cash, contracted future revenue, or LTV.

Rolling 3 Month rates are ratios of aggregated numerators and denominators. They are not averages of monthly percentages.

## Cost model

The target period is monthly.

The deterministic planning model is:

`Projected Revenue = New Customers × Revenue Per New Customer`

`Projected Acquisition Costs = Fixed Acquisition Costs + New Customers × Variable Non-Media Acquisition Cost Per New Customer + Ad Spend`

`Projected Non-Acquisition Costs = Fixed Non-Acquisition Costs + New Customers × Variable Non-Acquisition Cost Per New Customer`

`Projected Ad Spend = New Customers × Assumed Media CAC`

`Projected Real Net Profit = Projected Revenue − Projected Acquisition Costs − Projected Non-Acquisition Costs`

`Projected Real Net Profit Margin = Projected Real Net Profit / Projected Revenue`

The variable per-customer assumptions may include effective per-customer and percentage-of-revenue costs already normalized for the planning model. The engine itself does not silently reclassify expense items.

## Revenue target

For a Revenue target:

`Required New Customers = ceil(Target Revenue / Revenue Per New Customer)`

Required Revenue returned by the plan is the revenue implied by the whole-customer count:

`Required Revenue = Required New Customers × Revenue Per New Customer`

It may be higher than the entered target because customers are indivisible.

A Revenue target by itself defines no profit requirement. Therefore, for **maximum sustainable** CAC/CPL calculations only, Task 29 uses an explicit and returned break-even guardrail:

`Minimum Profit Constraint = 0`

This assumption is never hidden.

## Real Net Profit target

Let:

`Unit Profit Before Fixed Costs = Revenue Per New Customer − Variable Non-Media Acquisition Cost Per New Customer − Variable Non-Acquisition Cost Per New Customer − Assumed Media CAC`

`Total Fixed Costs = Fixed Acquisition Costs + Fixed Non-Acquisition Costs`

Then, when Unit Profit Before Fixed Costs is positive:

`Required New Customers = ceil((Target Real Net Profit + Total Fixed Costs) / Unit Profit Before Fixed Costs)`

A negative Unit Profit Before Fixed Costs is always unattainable for a non-negative Net Profit target, including a target of exactly zero. Adding a customer would reduce profit, so the engine must not return a ready plan that misses the target.

If Unit Profit Before Fixed Costs is exactly zero, a one-customer zero-profit plan is allowed only when the required contribution is also exactly zero, meaning both the Net Profit target and total fixed costs are zero. Otherwise the target is unattainable.

## Real Net Profit Margin target

For target margin `m`:

`Margin Headroom Per New Customer = Unit Profit Before Fixed Costs − (Revenue Per New Customer × m)`

Then:

`Required New Customers = ceil(Total Fixed Costs / Margin Headroom Per New Customer)`

The engine uses at least one customer because a margin on zero revenue is undefined.

If Margin Headroom Per New Customer is negative, the target margin cannot be reached by scale under the current assumptions.

If it is exactly zero, the target is possible only when fixed costs are zero.

This correctly models fixed-cost dilution and never averages historical margins.

## Funnel reverse engineering

The engine works backward from required New Customers.

Each stage rounds upward before moving to the previous stage:

- Required Sales = `ceil(New Customers / Sale-to-New-Customer Rate)`
- Required Qualified Calls = `ceil(Sales / Close Rate)`
- Required Shows = `ceil(Qualified Calls / Qualification Rate)`
- Required Bookings = `ceil(Shows / Show Rate)`
- Required Leads = `ceil(Bookings / Booking Rate)`

Stage-by-stage ceiling is intentional. The planner must not under-plan an upstream funnel count because of fractional people or calls.

All conversion-rate assumptions must be strictly greater than 0% and no greater than 100%.

## Maximum Sustainable CAC

Task 29's `Maximum Sustainable CAC` means **Maximum Sustainable Acquisition CAC**.

It is not Ultimate CAC and must never be labelled as Ultimate CAC.

For the chosen target and required customer count:

`Maximum Acquisition Budget = Required Revenue − Projected Non-Acquisition Costs − Minimum Profit Constraint`

`Maximum Sustainable Acquisition CAC = Maximum Acquisition Budget / Required New Customers`

The minimum profit constraint is:

- Revenue target → break-even (`0`)
- Net Profit target → entered target Net Profit
- Net Profit Margin target → Required Revenue × target margin

If non-acquisition economics already consume more than the available budget, Maximum Sustainable Acquisition CAC is unavailable with an explicit no-headroom reason.

## Maximum Media CAC

Maximum Sustainable Acquisition CAC includes all acquisition costs.

Mandatory non-media acquisition cost per new customer is:

`Fixed Acquisition Costs / Required New Customers + Variable Non-Media Acquisition Cost Per New Customer`

Therefore:

`Maximum Media CAC = Maximum Sustainable Acquisition CAC − Mandatory Non-Media Acquisition Cost Per New Customer`

If the result would be negative, there is no non-negative Media CAC that satisfies the sustainability constraint and Maximum Media CAC is returned unavailable.

## Maximum CPL

When Maximum Media CAC is available:

`Maximum Media Budget = Maximum Media CAC × Required New Customers`

`Maximum CPL = Maximum Media Budget / Required Leads`

Task 29 does not use attributed revenue or ROAS for these calculations.

## Insufficient Rolling 3 Month data

The default assumption resolver fails closed when required actual data is missing or when a required denominator is zero, including:

- no New Customers
- no Leads
- no Bookings
- no Shows
- no Qualified Calls
- no Sales
- non-positive aggregate Net Cash

It rejects current/incomplete or future months relative to the supplied `lastCompleteMonth`, rejects stale three-month windows that do not end at that boundary, and rejects impossible aggregate funnel sequences where a downstream count exceeds its upstream count.

No missing value is converted to zero and no conversion rate is invented.

## Exact arithmetic

Task 29 uses exact rational arithmetic backed by integers.

- No JavaScript floating-point arithmetic is used for financial formulas.
- Monetary results and percentages are returned as reduced exact fractions.
- Operational counts are rounded upward only at the explicitly documented funnel/customer boundaries.
- Count results must remain inside JavaScript's safe integer boundary or the engine fails closed.

## Known locked numerical example

Rolling 3 Month assumptions:

- Revenue Per New Customer = 1,000
- Fixed Acquisition Costs = 3,000/month
- Fixed Non-Acquisition Costs = 6,000/month
- Variable Non-Media Acquisition Cost = 100/customer
- Variable Non-Acquisition Cost = 200/customer
- Media CAC = 200
- Booking Rate = 50%
- Show Rate = 80%
- Qualification Rate = 75%
- Close Rate = 40%
- Sale-to-New-Customer Rate = 5/6

### Revenue target = 50,000

Expected:

- Required Customers = 50
- Sales = 60
- Qualified Calls = 150
- Shows = 200
- Bookings = 250
- Leads = 500
- Required Ad Spend = 10,000
- Projected Net Profit = 16,000
- Projected Margin = 32%
- Maximum Sustainable Acquisition CAC = 680
- Maximum Media CAC = 520
- Maximum CPL = 52

### Net Profit target = 20,000

Expected:

- Required Customers = 58
- Required Revenue = 58,000
- Sales = 70
- Qualified Calls = 175
- Shows = 234
- Bookings = 293
- Leads = 586
- Required Ad Spend = 11,600
- Projected Net Profit = 20,000
- Maximum Sustainable Acquisition CAC = 10,200 / 29
- Maximum Media CAC = 200
- Maximum CPL = 5,800 / 293

### Net Profit Margin target = 40%

Expected:

- Required Customers = 90
- Required Revenue = 90,000
- Sales = 108
- Qualified Calls = 270
- Shows = 360
- Bookings = 450
- Leads = 900
- Required Ad Spend = 18,000
- Projected Net Profit = 36,000
- Projected Margin = 40%
- Maximum Sustainable Acquisition CAC = 1,000 / 3
- Maximum Media CAC = 200
- Maximum CPL = 20

## Acceptance criteria

1. Revenue, Real Net Profit, and Real Net Profit Margin targets are supported.
2. Rolling 3 Month actuals create the default assumption set only from exactly three consecutive complete months ending at the supplied `lastCompleteMonth`.
3. Incomplete, future, or stale Rolling 3 windows are rejected before aggregation.
4. Every ready plan exposes all assumptions and their source.
5. Required Revenue, Customers, Sales, Qualified Calls, Shows, Bookings, Leads, and Ad Spend are returned.
6. Funnel counts round upward stage-by-stage.
7. Maximum Sustainable CAC is explicitly Acquisition CAC, never Ultimate CAC.
8. Maximum Media CAC deducts fixed and variable non-media acquisition costs.
9. Maximum CPL uses the sustainable media budget and required Leads.
10. Revenue targets disclose the break-even sustainability guardrail.
11. Net Profit and Margin targets use the entered profitability constraint.
12. Negative unit economics never return a ready non-negative Net Profit plan; the exact-zero boundary is allowed only when it truly meets zero profit.
13. Impossible unit economics or margin targets fail closed.
14. Missing/zero Rolling 3 Month denominators never produce invented assumptions.
15. Exact rational arithmetic is used for all financial calculations.
16. Numerical tests lock known inputs and expected outputs for all three target types and the zero/negative-profit boundaries.
17. The Task 29 `.mts` regression test is included in TypeScript checking.
18. No UI, persistence, simulator, database/RLS, or historical actual mutation is included.
