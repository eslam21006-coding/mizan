# Task 23 — Observed LTV

## Scope

Task 23 calculates realized customer value from Task 22 acquisition cohorts and durable transaction history.

Required product label:

**Observed LTV / قيمة العميل المحققة حتى الآن**

This is historical realized value to the observation cutoff. It is not a prediction of completed lifetime value.

## Formula

For an acquisition cohort and observation cutoff:

`Cumulative Cohort Net Cash = successful collections from original cohort customers through cutoff - successful refunds from those customers through cutoff`

`Observed LTV = Cumulative Cohort Net Cash / Original Cohort Size`

The original cohort size is the Task 22 fixed acquisition denominator and does not shrink because of refunds, inactivity, or churn.

Cumulative Net Cash and Observed LTV may decrease over time and may become negative when refunds exceed collected cash.

## Monthly observations and maturity

`public.customer_cohort_observations` produces monthly observations from the acquisition month through the business-local current reporting month.

For each observation it exposes:

- cohort month;
- observation month;
- observation cutoff date;
- fixed original cohort size;
- cumulative Gross Cash;
- cumulative Refunds;
- cumulative Net Cash;
- Observed LTV;
- exact canonical text values for financial display;
- cohort age;
- months observed;
- enforced business base currency.

Maturity follows the locked rules:

- acquisition month = `M0`;
- following month = `M1`;
- `cohort_age_months = calendar-month difference between cohort month and observation month`;
- `months_observed = cohort_age_months + 1`.

Past observation months use their calendar month-end cutoff. The current observation month is partial through the business-local current date, so future reporting dates are not silently included in the current snapshot.

Task 22 locks the business base currency and reporting timezone after transaction history exists and verifies existing history before cohort economics are enabled. Task 23 therefore never combines multiple currencies or reporting calendars inside one cohort denominator.

`public.customer_observed_ltv` exposes only the current observation row for each cohort for the product UI.

## Precision

All authoritative calculations remain PostgreSQL `numeric`.

The views also expose PostgreSQL-generated canonical text values for cumulative financial totals and Observed LTV so the browser does not convert authoritative money/ratio values through JavaScript binary floating-point arithmetic merely to display them.

## Arabic RTL UI

The business customer page includes a cohort section that shows:

- cohort month;
- original acquired customer count;
- cumulative Gross Cash / Refunds / Net Cash;
- **Observed LTV / قيمة العميل المحققة حتى الآن**;
- `M0`, `M1`, ... maturity;
- months observed;
- observation cutoff.

The UI explicitly states that the value is realized so far and must not imply that a young cohort has completed its lifetime.

## Security

The observation views use `security_invoker = true` and inherit the underlying business/customer transaction RLS boundary.

- authorized business members can read their allowed cohort observations;
- admins can read all allowed businesses;
- unrelated mentees cannot read another business's values by manipulating `business_id`;
- anonymous users have no view privilege.

## Acceptance criteria

Task 23 is complete only when:

1. Observed LTV uses cumulative cohort Net Cash divided by the fixed original cohort size.
2. Refunds reduce cumulative cohort value and are never counted as expenses.
3. The January example with 4 customers, 400 January cash, +100 February cash, and 80 March refund returns cumulative Net Cash = 420 and Observed LTV = 105 at M2 / 3 months observed.
4. A later 500 refund can reduce the same cohort to cumulative Net Cash = -80 and Observed LTV = -20; negative values remain valid.
5. Maturity uses calendar-month difference: acquisition month is M0 and months observed = age + 1.
6. Current-month cutoff never extends beyond the business-local current date.
7. Cohort currency/calendar remain singular because Task 22 enforces the business transaction reporting basis.
8. Financial calculations use PostgreSQL `numeric` and exact canonical text display values.
9. Unauthorized cross-business and anonymous reads are blocked; authorized member/admin reads are proven.
10. Arabic RTL browser verification covers the required label, exact values, maturity, current-cutoff messaging, no lifetime-completion claim, desktop behavior, and 390px containment.
11. Task 24 Lifetime Revenue Stream Analysis remains out of scope.
