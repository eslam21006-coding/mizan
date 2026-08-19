# Task 11 — Main Business Dashboard V1

## Purpose

Task 11 turns the authenticated Mizan home page into the first real business financial dashboard.

The dashboard is intentionally limited to one business and one selected month at a time. It reads saved Task 8 monthly snapshots and passes them through the locked Task 9 Core Financial Calculation Engine. It does not create a second calculation implementation in the UI.

## Acceptance criteria

Task 11 is complete when an authenticated user can:

- open the main dashboard from `/`;
- switch between businesses that database RLS allows that user to see;
- select a single month;
- see the selected business name, base currency, and month context;
- see saved monthly data calculated by `calculateCoreFinancials()`;
- navigate directly to the selected business/month monthly-entry screen;
- open a business dashboard from the Businesses page;
- use the dashboard in Arabic RTL on desktop and mobile without horizontal overflow.

## Primary metrics

The top row prioritizes:

1. Real Net Profit Margin;
2. Real Net Profit;
3. Ultimate CAC;
4. Net Cash Collected.

Ultimate CAC is explicitly described as:

**التكلفة الكاملة للبزنس لكل عميل جديد**

The UI also states that Ultimate CAC is a custom Mizan metric and not traditional CAC.

## Secondary metrics

The V1 dashboard also shows:

- Acquisition CAC;
- Contribution Margin;
- Contribution Profit;
- All Business Costs;
- Gross Cash Collected;
- Refunds;
- New Customers;
- Total Paying Customers;
- Returning Customers;
- Revenue Per Paying Customer;
- Revenue Per New Customer;
- expense totals for Acquisition, Fulfillment, Overhead, and Financial categories.

Revenue Per Paying Customer and Revenue Per New Customer are explicitly not labeled LTV.

## Historical snapshot boundary

The dashboard calculation adapter uses the monthly historical snapshot rows:

- `monthly_periods`;
- `monthly_revenue_entries`;
- `monthly_expense_entries`.

It does not recompute an old month from the current names/categories/behaviors of active setup items. This preserves historical meaning.

Missing database values remain `null` and therefore become unavailable metrics in the calculation engine. The dashboard must not coerce missing values to zero.

Invalid historical expense categories, behaviors, count bases, or malformed calculation inputs fail closed. The UI shows a safe calculation error state rather than inventing a number.

## Ad-spend and attribution boundary

Task 8 does not persist a canonical business-level Ad Spend field or attributed revenue field.

Therefore Task 11 intentionally does **not** infer:

- Media CAC from an expense item named “Ads”, “Ad Spend”, or similar;
- MER from an acquisition expense;
- ROAS from total business revenue.

The dashboard explains that Media CAC, MER, and ROAS require explicit canonical inputs in a later task/data-model extension.

## Single-period boundary

This PR does not add:

- Current Month vs Previous Month comparison;
- Rolling 3 Month values;
- YTD analytics;
- custom-range aggregation;
- trend arrows or growth percentages;
- funnel metrics;
- Observed LTV or cohorts;
- Lifetime Contribution Profit;
- decision-engine observations;
- targets;
- simulator scenarios;
- forecasts or recommendations.

Those remain separate tasks. Task 12 owns Month-over-Month comparisons.

## Verification

Task 11 includes:

- a known-input/known-output adapter test proving saved monthly snapshots produce the expected Task 9 engine outputs;
- a missing-value propagation test;
- a fail-closed historical-snapshot validation test;
- an authenticated Playwright flow that creates a business, revenue streams, expense structure, saves a known month, opens the dashboard, verifies Arabic RTL and known displayed economics, and verifies no horizontal overflow at mobile width.

## Merge gate

Before merge:

1. all business calculation tests pass;
2. full repository CI passes;
3. authenticated Arabic RTL browser verification passes;
4. CodeRabbit has zero unresolved actionable comments;
5. founder explicitly approves the Task 11 merge.
