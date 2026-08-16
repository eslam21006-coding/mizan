# Mizan Calculation Specification

**Status:** Task 1 — locked product specification
**Version:** 1.0
**Product:** Mizan — ميزان
**Scope:** Financial definitions, inclusions/exclusions, denominator rules, temporal aggregation, transaction semantics, funnel economics, cohort economics, and executable numerical examples.

This document is the authoritative source for Mizan's financial definitions. Later UI, dashboards, simulators, target planning, historical analytics, and decision rules must consume these definitions rather than redefining them.

## 1. Non-negotiable principles

1. Mizan uses **actual cash collected**, not contracted future revenue.
2. Refunds reduce revenue. They are **never also recorded as expenses**.
3. Monetary formulas use full precision internally. Rounding is a presentation concern only.
4. A ratio is not forced when its denominator is invalid. Mizan returns an unavailable value plus a reason instead of `Infinity`, `NaN`, or a fabricated zero.
5. Aggregated-period ratios are recomputed from aggregated numerators and denominators. Mizan must not average monthly ratios unless the product explicitly labels an arithmetic average.
6. Business-level economics are primary. Funnel economics are optional drill-downs.
7. `Ultimate CAC` is a custom Mizan metric and must always be explained as **التكلفة الكاملة للبزنس لكل عميل جديد**. It must never be presented as traditional CAC.
8. Revenue-per-customer period metrics are not LTV.
9. True/observed LTV comes from customer transaction history and acquisition cohorts.
10. Scenario calculations may reuse this specification but must never mutate historical actuals.

---

## 2. Canonical input conventions

### 2.1 Monetary values

Unless explicitly stated otherwise:

- Gross cash, refunds, expenses, ad spend, and positive transaction amounts are non-negative.
- Net cash can be negative when refunds in a reporting period exceed gross cash collected in that same period.
- All monetary values for a business are expressed in the business's single V1 base currency before inclusion in calculations.
- V1 must not silently perform FX conversion.

### 2.2 Counts

Counts are non-negative integers.

- `new_customers`: unique customers whose acquisition date is inside the reporting period.
- `total_paying_customers`: unique customers with at least one successful positive transaction inside the reporting period.
- A new customer is necessarily a paying customer in their acquisition period, therefore manual monthly data must satisfy `new_customers <= total_paying_customers`.

### 2.3 Percentage values

Percentage-based expense rates are stored as decimal rates for calculation (`10% = 0.10`). Rates must be non-negative.

### 2.4 Missing versus zero

Missing and zero are different:

- `0` means the value is known and equal to zero.
- `null/unavailable` means the value cannot be established from available data.

This distinction is mandatory for ROAS attribution, denominator-zero ratios, and incomplete funnel/cohort data.

---

## 3. Revenue and refunds

### 3.1 Gross Cash Collected

**Definition**

`Gross Cash Collected = sum of successfully collected positive cash transactions in the period`

It is measured before refunds and before subtracting processor fees, taxes, or any other expense.

### 3.2 Refunds

`Refunds = sum of successful refund amounts in the period, represented as positive magnitudes`

A refund is a contra-revenue item. It is not an expense.

### 3.3 Net Cash Collected

**Formula**

`Net Cash Collected = Gross Cash Collected - Refunds`

Net Cash Collected is allowed to be negative.

### 3.4 Refund double-counting prohibition

If a $1,000 payment is refunded:

- Gross Cash Collected includes the original $1,000 when collected.
- Refunds include $1,000 when refunded.
- The refund must not also appear in Acquisition, Fulfillment, Overhead, or Financial Costs.

### 3.5 Taxes and processor fees

Per the Mizan product model:

- Processor fees are Financial Costs.
- Taxes are Financial Costs.
- Neither is netted out of Gross Cash Collected before the Net Cash formula.

---

## 4. Expense model

Every expense item has:

- category
- behavior
- value/rate
- reporting period applicability
- when relevant, an explicit customer-count basis or attribution scope

### 4.1 Categories

#### Acquisition

Marketing, sales, and customer-acquisition costs, including examples such as:

- Ad Spend
- Media Buyer
- Creative Production
- Copywriting
- Sales Team
- Setters
- Sales Commissions
- Affiliate Commissions
- Marketing Tools
- Agency Fees

#### Fulfillment

Costs required to deliver/service customers, including examples such as:

- Coach Time
- Coaches/trainers salaries
- Customer Support
- Community Manager
- Zoom
- Course Platform
- Certificates
- Physical Products

#### Overhead

Administrative and operating costs, including examples such as:

- Admin
- Management
- General Software
- Rent
- Accounting
- Operations

#### Financial

V1 includes:

- Payment Processor Fees
- Taxes

Custom expense items are allowed inside any category.

### 4.2 Expense behaviors

#### Fixed Monthly

`Expense Amount = configured monthly amount`

For contribution calculations, Fixed Monthly expenses are non-variable and therefore excluded from Contribution Profit.

"Fixed Monthly" is an economic behavior classification, not a claim that the vendor contract can never change. For example, actual monthly ad spend may be entered as a monthly amount and is treated as non-variable for Mizan's Contribution Profit rule unless the expense itself is explicitly modeled with a variable behavior.

#### Per Customer

`Expense Amount = unit cost x applicable customer count`

A Per Customer expense must have an explicit count basis:

- `new_customers`, or
- `total_paying_customers`

The system must not silently guess a different basis at calculation time.

Recommended UI defaults may depend on category, but the stored basis remains explicit and auditable.

#### Percentage of Revenue

`Expense Amount = rate x max(Net Cash Collected, 0)`

Rationale: a period with negative Net Cash due to refunds must not silently create a negative expense credit. If an actual credit/reversal exists, it must be represented explicitly rather than inferred from a negative percentage calculation.

For a revenue-stream-scoped percentage expense, replace business Net Cash with the scoped stream's Net Cash.

### 4.3 Variable costs

For Mizan contribution metrics:

`Variable Costs = sum of all Per Customer expenses + all Percentage of Revenue expenses`

Variable/non-variable status follows behavior, not category. A variable Acquisition expense is still variable; a Fixed Monthly Fulfillment expense is still fixed.

### 4.4 Expense amount validity

Calculated expense amounts cannot be negative under the three V1 behaviors.

---

## 5. Core profitability metrics

### 5.1 Total costs by category

`Acquisition Costs = sum of Acquisition expense amounts`

`Fulfillment Costs = sum of Fulfillment expense amounts`

`Overhead Costs = sum of Overhead expense amounts`

`Financial Costs = sum of Financial expense amounts`

### 5.2 All Business Costs

`All Business Costs = Acquisition Costs + Fulfillment Costs + Overhead Costs + Financial Costs`

Refunds are excluded from All Business Costs because they have already reduced revenue.

### 5.3 Real Net Profit

`Real Net Profit = Net Cash Collected - Acquisition Costs - Fulfillment Costs - Overhead Costs - Financial Costs`

Equivalent form:

`Real Net Profit = Net Cash Collected - All Business Costs`

Real Net Profit can be negative.

### 5.4 Real Net Profit Margin

`Real Net Profit Margin = Real Net Profit / Net Cash Collected`

Denominator rule:

- if `Net Cash Collected > 0`, calculate normally;
- if `Net Cash Collected <= 0`, return unavailable with reason `NON_POSITIVE_NET_CASH`.

Do not coerce the margin to 0% and do not divide by gross cash instead.

---

## 6. CAC metrics

### 6.1 Media CAC

`Media CAC = Total Ad Spend / New Customers`

Rules:

- if `New Customers > 0`, calculate, including a valid result of `0` when Ad Spend is known to be zero;
- if `New Customers = 0`, return unavailable with reason `NO_NEW_CUSTOMERS`.

### 6.2 Acquisition CAC

`Acquisition CAC = Acquisition Costs / New Customers`

Rules:

- if `New Customers > 0`, calculate;
- if `New Customers = 0`, return unavailable with reason `NO_NEW_CUSTOMERS`.

### 6.3 Ultimate CAC

`Ultimate CAC = All Business Costs / New Customers`

Rules:

- includes Acquisition, Fulfillment, Overhead, and Financial Costs;
- if `New Customers > 0`, calculate;
- if `New Customers = 0`, return unavailable with reason `NO_NEW_CUSTOMERS`.

Required Arabic explanation wherever definition context is shown:

**التكلفة الكاملة للبزنس لكل عميل جديد**

Required product note: this is a custom Mizan fully-loaded business metric, not traditional CAC.

---

## 7. Period customer-value metrics

### 7.1 Revenue Per Paying Customer

`Revenue Per Paying Customer = Net Cash Collected / Total Paying Customers`

- if `Total Paying Customers > 0`, calculate;
- if `Total Paying Customers = 0`, return unavailable with reason `NO_PAYING_CUSTOMERS`.

### 7.2 Revenue Per New Customer

`Revenue Per New Customer = Net Cash Collected / New Customers`

- if `New Customers > 0`, calculate;
- if `New Customers = 0`, return unavailable with reason `NO_NEW_CUSTOMERS`.

Neither metric may be labeled LTV.

Negative values are allowed when period Net Cash is negative and the customer-count denominator is valid.

---

## 8. Contribution economics

### 8.1 Contribution Profit

`Contribution Profit = Net Cash Collected - Variable Costs`

Fixed Monthly expenses are excluded from Variable Costs and therefore are not subtracted in Contribution Profit. They remain included in Real Net Profit.

### 8.2 Contribution Margin

`Contribution Margin = Contribution Profit / Net Cash Collected`

Denominator rule:

- if `Net Cash Collected > 0`, calculate;
- if `Net Cash Collected <= 0`, return unavailable with reason `NON_POSITIVE_NET_CASH`.

---

## 9. Ad efficiency metrics

### 9.1 MER

`MER = Net Cash Collected / Total Ad Spend`

Arabic meaning:

**كفاءة الإنفاق الإعلاني على مستوى البزنس**

Rules:

- if `Total Ad Spend > 0`, calculate;
- if `Total Ad Spend = 0`, return unavailable with reason `NO_AD_SPEND`.

The numerator may be negative in a refund-heavy period; Mizan must not silently replace it with gross revenue.

### 9.2 Attributed Revenue

For Mizan, Attributed Revenue must represent actually collected cash that has real attribution to the relevant ads/funnel. It must not be contracted future revenue.

Where attributable refunds are known, they reduce attributed revenue.

### 9.3 ROAS

`ROAS = Attributed Revenue / Ad Spend`

Rules:

- calculate only if real attribution data exists;
- if attribution is unavailable, return unavailable with reason `ATTRIBUTION_UNAVAILABLE` even if total business revenue exists;
- if `Ad Spend = 0`, return unavailable with reason `NO_AD_SPEND`;
- total business revenue must never be substituted for Attributed Revenue.

---

## 10. Funnel metrics

For a funnel and reporting period, inputs may include:

- Ad Spend
- Leads
- Booked Calls
- Showed Calls
- Qualified Calls
- Sales
- New Customers
- Cash Collected
- Attributed Revenue

### 10.1 Formulas

`CPL = Ad Spend / Leads`

`Cost Per Booking = Ad Spend / Booked Calls`

`Cost Per Show = Ad Spend / Showed Calls`

`Cost Per Qualified Call = Ad Spend / Qualified Calls`

`Show Rate = Showed Calls / Booked Calls`

`Qualification Rate = Qualified Calls / Showed Calls`

`Close Rate = Sales / Qualified Calls`

`Lead-to-Sale Rate = Sales / Leads`

`Media CAC = Ad Spend / New Customers`

`ROAS = Attributed Revenue / Ad Spend`, subject to the attribution rules in section 9.

### 10.2 Funnel denominator rules

For each funnel ratio or cost metric:

- if the denominator is greater than zero, calculate;
- if the denominator is zero, return unavailable with a metric-specific reason;
- do not produce `Infinity` or `NaN`.

### 10.3 Defined benchmarks only

Show Rate is healthy only when:

`Show Rate > 65%`

Close Rate is healthy only when:

`Close Rate > 20%`

The thresholds are strict. Exactly 65% Show Rate and exactly 20% Close Rate are not classified as healthy by these rules.

No universal benchmark is currently defined for other funnel metrics.

---

## 11. Business/funnel ad-spend reconciliation

Ad spend must not be double-counted when the same spend appears at both business and funnel level.

V1 calculation requirement:

- there must be one canonical business-level Total Ad Spend for a period;
- linked funnel spend may roll up into that amount;
- a manually entered business ad-spend total and the same linked funnel spend must not be added together as if they were separate costs;
- any reconciliation mismatch must be surfaced rather than silently summed.

This rule protects Media CAC, MER, Acquisition Costs, Ultimate CAC, and Real Net Profit from duplicate ad spend.

---

## 12. Self-liquidating funnel economics

Revenue streams may be tagged `Front-End`, `Backend`, or `Other`.

### 12.1 Front-End Net Cash

`Front-End Net Cash = Front-End Gross Cash - Front-End Refunds`

### 12.2 Front-End variable costs

Include only variable costs attributable to Front-End economics.

- A stream-scoped Percentage of Revenue expense uses `max(Front-End Net Cash, 0)` as its base.
- A Per Customer expense requires a Front-End-relevant customer count or explicit allocation.
- If a material variable cost cannot be attributed or explicitly allocated between Front-End and other streams, an exact liquidation result must not be presented as fully known. Mark the result as estimated or insufficient according to the available allocation data.

### 12.3 Front-End Contribution Profit

`Front-End Contribution Profit = Front-End Net Cash - Front-End Variable Costs`

### 12.4 Ad Liquidation Rate

`Ad Liquidation Rate = Front-End Contribution Profit / Ad Spend`

- if `Ad Spend > 0`, calculate;
- if `Ad Spend = 0`, return unavailable with reason `NO_AD_SPEND`;
- values above 100% are allowed.

### 12.5 Effective Remaining Ad Cost

`Effective Remaining Ad Cost = Ad Spend - Front-End Contribution Profit`

Negative values are allowed and indicate Front-End Contribution Profit exceeded ad spend.

---

## 13. Transaction import semantics

### 13.1 Supported import types

- CSV
- XLSX

### 13.2 Required fields

- Customer Email
- Transaction Date
- Amount Collected

### 13.3 Optional fields

- Transaction ID
- Customer Name
- Product
- Revenue Stream
- Status
- Currency
- Refund / Transaction Type

### 13.4 Email normalization

`normalized_email = lowercase(trim(email))`

The normalized email is used for customer identity grouping in V1.

### 13.5 Successful positive transaction

A transaction can establish acquisition only when it is:

- successful/settled according to the mapped source status, and
- a positive collection transaction, not a refund.

### 13.6 Acquisition date

`Customer Acquisition Date = earliest successful positive transaction date for the normalized customer email`

A later purchase, upsell, renewal, or backend purchase does not reset acquisition date.

### 13.7 Duplicate protection

Duplicate detection is business-scoped.

If a Transaction ID exists:

`duplicate key = business + source + transaction_id`

If no Transaction ID exists:

`duplicate signature = business + normalized_email + canonical transaction date/time + normalized amount + source`

A duplicate must not be silently inserted a second time.

The import workflow must surface duplicate status to the user.

### 13.8 Currency rule in V1

A business has one base currency.

- If an imported row explicitly carries a different currency, the row is invalid for calculation until it is converted outside Mizan or a future explicit FX feature exists.
- Mizan must not silently convert it.
- If the file has no currency column, the import configuration must explicitly treat the source currency as the business base currency before rows are accepted.

---

## 14. Cohorts and Observed LTV

### 14.1 Monthly acquisition cohort

A customer belongs to the calendar month containing their acquisition date.

Example: first successful positive transaction on 2026-01-17 -> January 2026 cohort.

### 14.2 Original cohort size

`Original Cohort Size = number of unique customers acquired in that cohort month`

This denominator is fixed for the cohort and does not shrink because of refunds, inactivity, or churn.

### 14.3 Cohort cumulative Net Cash

For an observation cutoff:

`Cumulative Cohort Net Cash = all successful positive cash from original cohort customers through cutoff - all successful refunds from those customers through cutoff`

The value can decrease over time and can theoretically become negative.

### 14.4 Observed LTV

`Observed LTV = Cumulative Cohort Net Cash / Original Cohort Size`

Required label:

**Observed LTV / قيمة العميل المحققة حتى الآن**

Rules:

- if Original Cohort Size > 0, calculate;
- never imply that a young cohort has completed its lifetime;
- display cohort maturity.

### 14.5 Cohort maturity

For monthly reporting:

- acquisition month is `M0`;
- the following month is `M1`;
- `cohort_age_months = calendar-month difference between acquisition cohort month and observation month`;
- `months_observed = cohort_age_months + 1`.

Example: January cohort observed at end of March -> `M2`, three calendar months observed.

---

## 15. Lifetime Contribution Profit

The product term is **Lifetime Contribution Profit**. Do not use `LTGP`.

### 15.1 Included lifetime costs

Subtract, when attributable or explicitly allocated:

- acquisition costs
- customer-linked variable fulfillment costs
- other customer-linked variable costs
- payment processing costs where allocable

### 15.2 Excluded lifetime costs

Fixed overhead is excluded.

A fixed general overhead allocation must not be inserted merely to make the metric look like lifetime net profit.

### 15.3 Formula

At cohort/customer scope:

`Lifetime Contribution Profit = Lifetime Net Cash - Attributable/Allocated Acquisition Costs - Customer-Linked Variable Fulfillment Costs - Other Customer-Linked Variable Costs - Allocable Payment Processing Costs`

### 15.4 Attribution quality

Cost attribution should follow this hierarchy:

1. directly attributable actual cost;
2. explicit user-provided allocation;
3. deterministic estimated allocation when the product later defines one;
4. unavailable if required cost information is materially missing.

Any result containing estimated allocation must be labeled as an estimate.

Fixed Overhead remains excluded even when an estimated allocation is used.

---

## 16. Time aggregation

Primary storage/reporting cadence is monthly.

Supported reporting views include:

- Current Month
- Previous Month
- Rolling 3 Months
- YTD
- Custom Range

### 16.1 Aggregating additive values

For full months, sum additive values such as:

- Gross Cash Collected
- Refunds
- Net Cash Collected
- expense amounts
- Ad Spend
- Attributed Revenue
- funnel counts when representing non-overlapping events

### 16.2 Aggregating unique customer counts

Do not sum monthly unique customer counts when that would double-count the same customer across the combined period.

For a multi-month range:

- `New Customers` = unique customers whose acquisition date falls in the combined range;
- `Total Paying Customers` = unique customers with at least one successful positive transaction in the combined range.

When only monthly manual aggregate counts exist and cross-month deduplication is impossible, the product must label the combined customer count as an aggregate estimate or withhold unique-customer-derived metrics rather than falsely claiming exact uniqueness.

### 16.3 Recompute ratios from totals

For Rolling 3 Month, YTD, and Custom Range, recompute ratio metrics using aggregated numerators and denominators.

Examples:

`Aggregated Real Net Profit Margin = sum(Real Net Profit numerator) / sum(Net Cash Collected denominator)`

`Aggregated Media CAC = total Ad Spend / unique New Customers in range`

Do not average monthly margins or monthly CAC values to represent the combined period.

### 16.4 Current vs Previous Month

For a percentage change:

`percent_change = (current - previous) / abs(previous)` only when `previous != 0` and the metric's comparison semantics permit it.

If previous is zero, percentage change is unavailable; show the absolute change instead. Do not invent an infinite percentage.

### 16.5 Rolling 3 Month default assumptions

Later Target Planner logic may use Rolling 3 Month actual performance when sufficient data exists. Task 1 locks only the aggregation rule, not the inverse Target Planner equations that belong to Tasks 29–31.

### 16.6 Custom Range and monthly-only expenses

Mizan must not fabricate day-level precision from monthly-only expense data.

For V1, a custom range may be exact only where the underlying data supports the requested granularity. When an expense exists only as a monthly actual amount and the range cuts through that month, the product must either:

- use an explicitly documented prorating rule supplied by the later reporting implementation, or
- mark the expense-derived result as estimated/unavailable.

Silent prorating is prohibited. The exact UX/implementation choice is deferred to the reporting task, but the auditability requirement is locked here.

---

## 17. Rounding and numeric precision

1. Monetary calculations must not rely on binary floating-point arithmetic for authoritative financial results.
2. Implementation should use decimal arithmetic or integer minor units as appropriate.
3. Do not round intermediate values merely for display convenience.
4. Round only at defined presentation/export boundaries.
5. Currency display precision must respect the selected currency. KWD commonly requires three fractional digits; the other currently supported currencies can be displayed with their applicable currency precision.
6. Ratios/percentages may be formatted for readability, but the underlying value remains full precision.

---

## 18. Data-quality invariants

The calculation layer must reject or flag impossible/ambiguous inputs rather than silently correcting them.

Examples:

- negative Gross Cash input
- negative Refunds input
- negative counts
- non-integer counts
- `new_customers > total_paying_customers`
- mismatched imported currency in V1
- missing attribution presented as ROAS
- duplicate transaction import
- duplicated ad spend between funnel rollups and business manual totals

A data-quality warning must not be converted into a deterministic business conclusion.

---

## 19. Deterministic decision-rule dependencies

Task 1 does not implement the Decision Engine, but locks the metric semantics used by later rules.

Examples already approved by product:

- `Show Rate < 65% AND Close Rate > 20%` -> attendance is probably a bigger bottleneck than sales conversion.
- stable Media CAC + rising Ultimate CAC -> investigate costs outside media buying.
- revenue rising + Real Net Profit falling -> unhealthy growth; inspect expense categories growing faster than revenue.
- high CAC + strong backend/LTV/customer contribution -> do not automatically classify acquisition as unhealthy.
- healthy acquisition + weak LTV/customer value -> inspect upsells, renewals, backend, cross-sells, pricing, retention.

If the required inputs are insufficient, the later engine must say:

**البيانات غير كافية للحكم**

No rule may manufacture missing data.

---

## 20. Known numerical examples

These examples are mirrored by executable tests in `test/calculation-spec.examples.test.mjs`.

### Example A — full business month

Inputs:

- Gross Cash = 100,000
- Refunds = 5,000
- Net Cash = 95,000
- New Customers = 50
- Paying Customers = 80
- Ad Spend = 20,000 (Acquisition, Fixed Monthly behavior)
- Media Buyer = 5,000 (Acquisition, Fixed Monthly)
- Sales Commission = 10% of Net Cash = 9,500 (Acquisition, Percentage)
- Fulfillment Team = 8,000 (Fulfillment, Fixed Monthly)
- Certificates = 20 x 80 paying customers = 1,600 (Fulfillment, Per Customer)
- Course Platform variable fee = 5% x 95,000 = 4,750 (Fulfillment, Percentage)
- Overhead = 10,000 (Overhead, Fixed Monthly)
- Processor Fees = 3% x 95,000 = 2,850 (Financial, Percentage)
- Taxes = 5% x 95,000 = 4,750 (Financial, Percentage)
- Attributed Revenue = 60,000

Expected:

- Acquisition Costs = 34,500
- Fulfillment Costs = 14,350
- Financial Costs = 7,600
- All Business Costs = 66,450
- Real Net Profit = 28,550
- Real Net Profit Margin = 28,550 / 95,000 = 30.0526315789%
- Media CAC = 400
- Acquisition CAC = 690
- Ultimate CAC = 1,329
- Revenue Per Paying Customer = 1,187.50
- Revenue Per New Customer = 1,900
- Variable Costs = 23,450
- Contribution Profit = 71,550
- Contribution Margin = 75.3157894737%
- MER = 4.75
- ROAS = 3.00

### Example B — refund-heavy period

Inputs:

- Gross Cash = 10,000
- Refunds = 12,000
- Net Cash = -2,000
- New Customers = 2
- Paying Customers = 3
- Ad Spend = 1,000
- Other Fixed Costs = 3,000
- Percentage expense rate = 10%

Expected:

- Percentage expense amount = 0 because base is `max(-2,000, 0)`
- All Business Costs = 4,000
- Real Net Profit = -6,000
- Real Net Profit Margin = unavailable (`NON_POSITIVE_NET_CASH`)
- Revenue Per New Customer = -1,000
- Revenue Per Paying Customer = -666.666666...
- MER = -2.0
- Contribution Margin = unavailable (`NON_POSITIVE_NET_CASH`)

### Example C — no new customers

Inputs:

- Net Cash = 5,000
- New Customers = 0
- Paying Customers = 5
- Ad Spend = 2,000
- Acquisition Costs = 2,500
- All Business Costs = 4,000

Expected:

- Media CAC = unavailable (`NO_NEW_CUSTOMERS`)
- Acquisition CAC = unavailable (`NO_NEW_CUSTOMERS`)
- Ultimate CAC = unavailable (`NO_NEW_CUSTOMERS`)
- Revenue Per New Customer = unavailable (`NO_NEW_CUSTOMERS`)
- Revenue Per Paying Customer = 1,000
- MER = 2.5

### Example D — zero ad spend with real new customers

Inputs:

- New Customers = 5
- Ad Spend = 0
- Net Cash = 10,000

Expected:

- Media CAC = 0
- MER = unavailable (`NO_AD_SPEND`)
- ROAS = unavailable (`NO_AD_SPEND`) if attribution exists but spend is zero

### Example E — attribution unavailable

Inputs:

- Ad Spend = 10,000
- Total Business Net Cash = 50,000
- Attributed Revenue = unavailable

Expected:

- MER = 5.0
- ROAS = unavailable (`ATTRIBUTION_UNAVAILABLE`)
- Mizan must not report ROAS = 5.0 by substituting business revenue.

### Example F — funnel

Inputs:

- Ad Spend = 10,000
- Leads = 500
- Booked Calls = 100
- Showed Calls = 60
- Qualified Calls = 30
- Sales = 9
- New Customers = 8
- Attributed Revenue = 20,000

Expected:

- CPL = 20
- Cost Per Booking = 100
- Cost Per Show = 166.666666...
- Cost Per Qualified Call = 333.333333...
- Show Rate = 60%
- Qualification Rate = 50%
- Close Rate = 30%
- Lead-to-Sale Rate = 1.8%
- Media CAC = 1,250
- ROAS = 2.0
- Show Rate is not healthy; Close Rate is healthy.

### Example G — strict benchmark boundaries

Expected:

- Show Rate = 65% -> not classified healthy under `> 65%`
- Show Rate = 65.01% -> healthy
- Close Rate = 20% -> not classified healthy under `> 20%`
- Close Rate = 20.01% -> healthy
- attendance-bottleneck rule does not fire at exactly 65% Show Rate because the approved rule is `< 65%`.

### Example H — self-liquidating funnel above 100%

Inputs:

- Front-End Net Cash = 15,000
- Front-End Variable Costs = 3,000
- Ad Spend = 10,000

Expected:

- Front-End Contribution Profit = 12,000
- Ad Liquidation Rate = 120%
- Effective Remaining Ad Cost = -2,000

### Example I — aggregate ratio must be recomputed

Month 1:

- Net Cash = 1,000
- Real Net Profit = 100
- Margin = 10%

Month 2:

- Net Cash = 100
- Real Net Profit = 50
- Margin = 50%

Expected combined period:

- Net Cash = 1,100
- Real Net Profit = 150
- Real Net Profit Margin = 150 / 1,100 = 13.6363636%
- 30% (the simple average of 10% and 50%) is incorrect for the combined period.

### Example J — Observed LTV cohort

January cohort:

- 4 originally acquired customers
- January net cash from cohort = 400
- February additional net cash = 100
- March refund = 80

Observed at end of March:

- Cumulative Cohort Net Cash = 420
- Original Cohort Size = 4
- Observed LTV = 105
- Cohort age = M2
- Months observed = 3

### Example K — Lifetime Contribution Profit excludes fixed overhead

Inputs:

- Lifetime Net Cash = 10,000
- Acquisition Costs attributable/allocated = 2,500
- Customer-linked variable Fulfillment = 1,000
- Other customer-linked variable costs = 500
- Allocable processor fees = 300
- Fixed Overhead = 4,000

Expected:

- Lifetime Contribution Profit = 10,000 - 2,500 - 1,000 - 500 - 300 = 5,700
- The 4,000 fixed overhead is not subtracted.

---

## 21. Explicitly deferred implementation decisions

The following are deliberately not implemented or silently invented in Task 1:

- Next.js application shell
- UI or navigation
- Supabase schema/RLS
- production calculation engine module
- monthly data-entry schema
- Target Planner inverse equations (Tasks 29–31)
- scenario persistence model
- exact Custom Range partial-month allocation UX
- AI-generated financial judgments

When those tasks are implemented, they must conform to this specification or change it through an explicit reviewed financial-spec PR with updated numerical tests.

---

## 22. Task 1 acceptance criteria

Task 1 is complete only when all of the following are true:

1. This specification is committed as the authoritative finance source of truth.
2. All approved formulas are stated explicitly.
3. Expense inclusions/exclusions and behavior semantics are explicit.
4. Refund treatment and anti-double-counting rules are explicit.
5. Zero/missing/non-positive denominator behavior is explicit.
6. Period customer-value metrics are explicitly distinguished from LTV.
7. Ultimate CAC is explicitly labeled a custom Mizan metric.
8. Funnel formulas and only the approved benchmarks are defined.
9. Self-liquidating funnel formulas allow >100% liquidation and negative remaining ad cost.
10. Transaction identity, acquisition date, duplicate, and currency rules are explicit.
11. Observed LTV and cohort maturity rules are explicit.
12. Lifetime Contribution Profit inclusions/exclusions are explicit.
13. Rolling/YTD/custom aggregation does not average ratios or silently fake uniqueness/precision.
14. At least the numerical examples in section 20 are executable and passing.
15. No Task 2 application UI or framework setup is introduced.
16. The Task 1 PR has zero unresolved actionable CodeRabbit comments.
17. Final verification confirms the merged `main` contains the approved specification and passing examples.
