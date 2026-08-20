# Task 12 — Month-over-Month Comparisons

## Scope

Task 12 activates the authenticated `/analytics` route for one comparison only:

**selected month vs the immediately previous calendar month for the same business.**

It does not implement Rolling 3 Month, YTD, custom ranges, funnels, LTV, recommendations, forecasting, the Decision Engine, Target Planner, or Simulator.

## Source of truth

Each month is loaded independently from its saved historical snapshots:

- `monthly_periods`
- `monthly_revenue_entries`
- `monthly_expense_entries`

Each month is then recomputed through the locked `calculateCoreFinancials()` engine. Task 12 does not store comparison results and does not compare persisted or rounded KPI values.

Missing values remain missing. A missing previous month is not treated as zero.

## Comparison math

For money, counts, and money-like ratios:

- signed change = current − previous
- direction = up / down / flat from the sign of the exact change
- relative change = signed change ÷ absolute(previous)
- if previous = 0, relative percentage is unavailable; the exact signed change can still be shown

Using the magnitude of the previous value keeps direction meaningful when a metric crosses zero. Example: Real Net Profit moving from −10,000 to +5,000 is an upward change of 15,000 and a +150% relative change.

All comparison math uses exact integer/rational arithmetic. JavaScript floating-point conversion is presentation-only.

## Ratio and margin presentation

For ratio KPIs such as Real Net Profit Margin and Contribution Margin, the primary delta is displayed in **percentage points**.

Example:

- previous margin: 65%
- current margin: 72.1%
- displayed change: ↑ 7.1 percentage points

This avoids presenting a margin-point difference as though it were revenue growth.

## Direction is not a judgment

An upward arrow means only that the numeric value increased. It does not mean the business improved.

Examples:

- Real Net Profit increasing may be favorable.
- Ultimate CAC increasing may be unfavorable.

Task 12 does not add deterministic recommendations or health classification. Those belong to later decision-engine work.

## Metrics compared

The V1 comparison panel includes:

- Real Net Profit Margin
- Real Net Profit
- Ultimate CAC — still the Mizan custom metric **التكلفة الكاملة للبزنس لكل عميل جديد**, not traditional CAC
- Net Cash Collected
- Acquisition CAC
- Contribution Margin
- Contribution Profit
- New Customers
- Total Paying Customers
- Revenue Per Paying Customer — not LTV

## Error and empty-state behavior

- If the selected month does not exist, prompt for selected-month data entry.
- If the previous calendar month does not exist, explain that no comparison baseline exists and link to that month’s data entry.
- If either month cannot be safely loaded or calculated, fail closed and show no inferred comparison.
- If an individual KPI is unavailable in either month, that KPI’s comparison is unavailable rather than coerced to zero.

## Verification requirements

Before merge:

1. Known-input numerical tests must cover exact signed/relative changes, zero previous values, negative-to-positive crossing, ratio percentage-point deltas, and unavailable values.
2. An integrated test must calculate two monthly snapshots through the canonical engine before comparison.
3. Authenticated browser verification must cover Arabic `lang=ar`, `dir=rtl`, adjacent-month values, comparison deltas, browser errors, and 390px horizontal overflow.
4. Full CI must pass on the exact PR head.
5. CodeRabbit must have zero unresolved actionable comments.
6. Founder approval is required before merge.
