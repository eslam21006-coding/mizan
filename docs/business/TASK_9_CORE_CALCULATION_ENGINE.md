# Task 9 — Core Financial Calculation Engine

## Scope

Task 9 adds the central deterministic calculation layer that consumes normalized monthly business inputs and returns canonical financial metrics.

This task is calculation logic only. It does not add or redesign monthly data-entry UI, dashboards, comparisons, scenarios, recommendations, funnels, cohorts/LTV, target planning, simulator logic, or rolling/YTD analytics.

`docs/CALCULATION_SPEC.md` remains authoritative. Task 9 implements, but does not redefine, those financial rules.

## Precision contract

- Monetary inputs enter the engine as canonical decimal strings.
- The engine performs addition, subtraction, multiplication, and percentage calculations with integer/scale decimal arithmetic rather than JavaScript floating-point arithmetic.
- Money and calculated expense amounts are returned as normalized exact decimal strings.
- Ratios are returned as reduced exact fractions `{ numerator, denominator }` so Task 9 never rounds a KPI internally.
- Rounding and localized percentage/currency formatting belong to presentation layers in later tasks.

## Missing versus zero

All raw monthly monetary inputs and customer counts preserve Task 8's distinction:

- explicit `0` is known zero;
- `null` is unavailable.

If a required component of a total is unavailable, the dependent metric is unavailable rather than treating the missing component as zero.

Unavailable ratio reasons include:

- `INPUT_UNAVAILABLE`
- `NO_NEW_CUSTOMERS`
- `NO_PAYING_CUSTOMERS`
- `NON_POSITIVE_NET_CASH`
- `NO_AD_SPEND`
- `ATTRIBUTION_UNAVAILABLE`

No metric returns `NaN`, `Infinity`, or a fabricated zero for an invalid denominator.

## Revenue

For every revenue stream:

`Stream Net Cash = Stream Gross Cash - Stream Refunds`

Business totals include stream values plus Task 8 unallocated values:

`Gross Cash Collected = sum(stream gross cash) + unallocated gross cash`

`Refunds = sum(stream refunds) + unallocated refunds`

`Net Cash Collected = Gross Cash Collected - Refunds`

Refunds remain contra-revenue and are never included in expense totals.

## Customer metrics

The engine returns:

- New Customers
- Total Paying Customers
- Returning Customers = Total Paying Customers - New Customers

When both customer counts are available, `new_customers <= total_paying_customers` is enforced.

## Expense calculations

Task 9 supports the four existing categories:

- Acquisition
- Fulfillment
- Overhead
- Financial

And the three existing behaviors:

### Fixed Monthly

`Expense Amount = input value`

### Per Customer

`Expense Amount = unit cost × explicit customer-count basis`

The basis must be exactly `new_customers` or `total_paying_customers`. The engine never guesses.

### Percentage of Revenue

`Expense Amount = decimal rate × max(Net Cash Collected, 0)`

A refund-heavy period therefore cannot create a negative inferred expense credit.

Variable Costs are all Per Customer plus Percentage of Revenue expense amounts, regardless of category.

The engine returns expense amounts by item, totals by category, All Business Costs, and Variable Costs.

## Profitability and customer economics

Task 9 implements:

- Real Net Profit
- Real Net Profit Margin
- Contribution Profit
- Contribution Margin
- Acquisition CAC
- Ultimate CAC
- Revenue Per Paying Customer
- Revenue Per New Customer

Ultimate CAC remains Mizan's custom fully-loaded metric:

**التكلفة الكاملة للبزنس لكل عميل جديد**

It is not traditional CAC.

Revenue Per Paying Customer and Revenue Per New Customer must never be labeled LTV.

## Ad-spend boundary

Task 7 expense items currently have category, behavior, name, and active state, but no canonical semantic field that marks an item as ad spend.

Therefore Task 9 deliberately does **not** infer Total Ad Spend from an expense name such as `Ad Spend`, `Facebook Ads`, or any localized/custom label.

Media CAC and MER accept only an explicitly supplied canonical business-level ad-spend value. If no canonical ad-spend input is supplied, they return `INPUT_UNAVAILABLE`.

This prevents name-based guessing and future double-counting when funnel reconciliation is introduced.

## ROAS boundary

ROAS is calculated only when both:

- real Attributed Revenue is explicitly supplied; and
- canonical Ad Spend is explicitly supplied and greater than zero.

Total business revenue is never substituted for Attributed Revenue.

## Deferred

The following remain outside Task 9:

- transaction-history cohorts;
- Observed LTV;
- Lifetime Contribution Profit;
- funnel KPIs and funnel ad-spend reconciliation;
- self-liquidating funnel calculations;
- dashboard/UI presentation;
- current-vs-previous-month comparisons;
- Rolling 3 Months and YTD aggregation;
- deterministic decision-engine rules;
- target planner;
- simulator/scenario logic.

## Required verification

Because Task 9 changes financial logic, it must include known-input/known-output numerical tests. Task 10 will expand the calculation test suite, but Task 9 cannot merge without direct numerical regression coverage for every metric introduced here and edge cases for missing values, zero denominators, negative net cash, and expense behavior semantics.
