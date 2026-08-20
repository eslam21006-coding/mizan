# Task 13 — Rolling 3 Month / YTD / Historical Analytics

## Scope

Task 13 extends the authenticated `/analytics` route without replacing Task 12 month-over-month comparison.

It adds three full-month historical views for one business:

- Rolling 3 Months
- YTD
- Custom Range

Custom Range uses month boundaries in V1. Task 13 does not invent day-level expense precision or silently prorate monthly-only expense actuals.

## Source of truth

Every included month is loaded from the preserved Task 8 snapshots and calculated independently through the locked Task 9 financial engine.

For a full-month historical period, additive results are then summed across the included months:

- Gross Cash Collected
- Refunds
- Net Cash Collected
- expense amounts by category
- All Business Costs
- Variable Costs
- Real Net Profit
- Contribution Profit

This is important for Percentage of Revenue expenses. Their monthly amount is based on each month's own `max(Net Cash Collected, 0)` base. Task 13 sums those already-calculated monthly expense amounts; it does not reapply a percentage rate to combined Net Cash.

## Ratio recomputation

Historical ratios are recomputed from aggregated numerators and denominators.

Task 13 never averages monthly margins.

Examples:

`Historical Real Net Profit Margin = total Real Net Profit / total Net Cash Collected`

`Historical Contribution Margin = total Contribution Profit / total Net Cash Collected`

If combined Net Cash is non-positive, those margins remain unavailable under the locked denominator rule.

## Missing months and missing values

A requested historical range is complete only when every expected calendar month has a saved monthly period.

- Missing months are listed explicitly.
- Missing months are never treated as zero.
- A partial sum is never presented as the complete requested range.
- A load or calculation error fails the combined result closed.
- Missing additive inputs remain unavailable rather than being coerced to zero.

## Multi-month customer counts

Task 8 stores manual monthly aggregate customer counts, not customer identities. Summing monthly paying-customer counts can double-count a customer who pays in more than one month.

Task 13 may show:

- sum of monthly reported New Customers, and
- sum of monthly reported Total Paying Customers,

but labels them as monthly reported sums, not exact unique customers for the combined period.

Therefore exact multi-month customer-derived KPIs are withheld from this manual-data historical view, including:

- Acquisition CAC
- Ultimate CAC — the Mizan metric **التكلفة الكاملة للبزنس لكل عميل جديد**
- Revenue Per Paying Customer
- Revenue Per New Customer
- Media CAC where its customer denominator would need exact range uniqueness

Transaction-history work will later provide the customer identity needed for exact cross-month deduplication and Observed LTV/cohort analysis.

## Period resolution

### Rolling 3 Months

The selected month is the end month and the range includes it plus the immediately preceding two calendar months.

Example: selected April 2026 -> February, March, April 2026.

If the range would cross before January 2000, the view fails closed as outside the supported range.

### YTD

The selected month is the end month and the range begins in January of the same calendar year.

Example: selected April 2026 -> January through April 2026.

### Custom Range

The user selects a start month and an end month, inclusive.

The start must not come after the end. Both values must be valid supported month keys. Because the controls are month-based, the period covers complete calendar months only.

To keep one authenticated analytics request bounded in V1, a Custom Range may include at most 36 calendar months. Longer ranges fail closed with an explicit user-facing message instead of starting an excessive number of historical snapshot queries.

## Historical breakdown

Alongside the combined result, Task 13 shows each included month separately with:

- Net Cash Collected
- Real Net Profit
- Real Net Profit Margin

This is a read-only view of historical actuals. Scenario logic and historical mutation are out of scope.

## Explicitly out of scope

- partial-month custom-range prorating
- funnels and funnel economics
- transaction import
- exact multi-month unique-customer KPIs from transaction history
- Observed LTV and cohorts
- Lifetime Contribution Profit
- Decision Engine
- Target Planner
- Simulator
- forecasting or recommendations

## Verification requirements

Before merge:

1. Numerical tests must verify full-month period resolution, the 36-month Custom Range boundary, exact additive aggregation, ratio recomputation, refund-heavy Percentage-of-Revenue behavior, unavailable-value propagation, and customer-count precision boundaries.
2. Authenticated browser verification must save at least four adjacent months and verify Rolling 3 Months, YTD, and Custom Range results.
3. Browser verification must confirm Arabic `lang=ar`, `dir=rtl`, responsive 390px layout, and no browser errors.
4. Full CI must pass on the exact PR head.
5. CodeRabbit must have zero unresolved actionable comments.
6. Founder approval is required before merge.
