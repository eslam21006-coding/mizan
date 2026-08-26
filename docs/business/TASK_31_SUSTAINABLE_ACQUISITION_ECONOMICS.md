# Task 31 — Maximum Sustainable CAC / CPL / Related Economics

## Purpose

Task 31 owns the reusable sustainability ceilings used by the Target Planner after the target revenue, customer count, lead requirement, and profitability constraint are known.

There is one formula path. `planTarget` delegates to `calculateSustainableAcquisitionEconomics`; the Target Engine does not maintain a second copy of these formulas.

## Naming rule

**Maximum Sustainable CAC means Maximum Sustainable Acquisition CAC.**

It is never Ultimate CAC.

Ultimate CAC remains Mizan's custom fully-loaded metric covering all business costs. Task 31 instead answers how much **Acquisition cost** can be sustained while still satisfying the selected target's profitability constraint.

## Inputs

- Required Revenue
- Required New Customers
- Required Leads
- Profit Constraint Amount
- Monthly Fixed Acquisition Costs
- Monthly Fixed Non-Acquisition Costs
- Variable Non-Media Acquisition Cost Per New Customer
- Variable Non-Acquisition Cost Per New Customer

All financial inputs use exact ratios. Counts are positive safe integers.

## Non-acquisition economics

`Projected Non-Acquisition Costs = Fixed Non-Acquisition Costs + Required Customers × Variable Non-Acquisition Cost Per New Customer`

`Acquisition Budget Headroom = Required Revenue − Projected Non-Acquisition Costs − Profit Constraint Amount`

If this headroom is negative, there is no sustainable non-negative Acquisition CAC and the metric is unavailable with `NO_ACQUISITION_HEADROOM`.

A headroom of exactly zero is valid and produces a Maximum Sustainable Acquisition CAC of zero.

## Maximum Sustainable Acquisition CAC

When Acquisition Budget Headroom is non-negative:

`Maximum Sustainable Acquisition CAC = Acquisition Budget Headroom / Required Customers`

## Mandatory non-media acquisition costs

`Mandatory Non-Media Acquisition Costs = Fixed Acquisition Costs + Required Customers × Variable Non-Media Acquisition Cost Per New Customer`

`Mandatory Non-Media Acquisition Cost Per Customer = Mandatory Non-Media Acquisition Costs / Required Customers`

## Maximum Media CAC

`Media Budget Headroom = Acquisition Budget Headroom − Mandatory Non-Media Acquisition Costs`

When Media Budget Headroom is non-negative:

`Maximum Media CAC = Media Budget Headroom / Required Customers`

If Media Budget Headroom is negative, Maximum Media CAC is unavailable with `NO_MEDIA_HEADROOM`.

This ensures media budget is calculated **after** preserving fixed and variable non-media acquisition requirements.

## Maximum CPL

When Maximum Media CAC is available:

`Maximum CPL = Media Budget Headroom / Required Leads`

If Maximum Media CAC is unavailable, Maximum CPL is unavailable with `MAX_MEDIA_CAC_UNAVAILABLE`.

No ROAS, attributed revenue, or total business revenue substitution is introduced in this calculation.

## Profit constraint semantics

Task 31 receives the target-period profit constraint already selected by Task 29:

- Revenue target → break-even amount `0` for sustainability ceilings only
- Net Profit target → entered target Net Profit
- Net Profit Margin target → Required Revenue × target margin

For a Revenue target, break-even is **not** a second Revenue-plan readiness target. A below-break-even Revenue plan may still meet the selected Revenue goal while showing negative projected profit. In that case Task 31's sustainable CAC/CPL metrics fail closed when the available headroom is negative.

## Known numerical examples

### Revenue target

Inputs:

- Required Revenue = 50,000
- Required Customers = 50
- Required Leads = 500
- Profit Constraint = 0
- Fixed Acquisition = 3,000
- Fixed Non-Acquisition = 6,000
- Variable Non-Media Acquisition = 100/customer
- Variable Non-Acquisition = 200/customer

Expected:

- Projected Non-Acquisition Costs = 16,000
- Acquisition Budget Headroom = 34,000
- Mandatory Non-Media Acquisition Costs = 8,000
- Mandatory Non-Media Acquisition Cost Per Customer = 160
- Media Budget Headroom = 26,000
- Maximum Sustainable Acquisition CAC = 680
- Maximum Media CAC = 520
- Maximum CPL = 52

### Net Profit target

For Required Revenue 58,000, Required Customers 58, Required Leads 586, and Profit Constraint 20,000:

- Acquisition Budget Headroom = 20,400
- Maximum Sustainable Acquisition CAC = 10,200 / 29
- Media Budget Headroom = 11,600
- Maximum Media CAC = 200
- Maximum CPL = 5,800 / 293

### Net Profit Margin target

For Required Revenue 90,000, Required Customers 90, Required Leads 900, and Profit Constraint 36,000:

- Acquisition Budget Headroom = 30,000
- Maximum Sustainable Acquisition CAC = 1,000 / 3
- Media Budget Headroom = 18,000
- Maximum Media CAC = 200
- Maximum CPL = 20

## Failure behavior

- Negative financial inputs are rejected.
- Required Revenue must be positive.
- Required Customers and Required Leads must be positive safe integers.
- Negative Acquisition Budget Headroom makes sustainable Acquisition CAC unavailable.
- Negative Media Budget Headroom makes Media CAC unavailable.
- CPL is unavailable whenever Media CAC is unavailable.
- Exactly zero headroom is a valid known-zero metric, not missing data.
- Negative headroom is retained in the structured result for auditability even though the sustainable metric itself is unavailable.

## Explicitly out of scope

Task 31 does not:

- calculate Ultimate CAC,
- change the financial target itself,
- infer attribution or ROAS,
- mutate historical actual data,
- add UI,
- add persistence/database/RLS behavior,
- implement Task 32 simulator scenarios.

## Acceptance criteria

1. Sustainable acquisition economics live in one reusable pure module.
2. Maximum Sustainable CAC is explicitly Maximum Sustainable **Acquisition CAC**, never Ultimate CAC.
3. Projected non-acquisition costs and acquisition budget headroom are calculated exactly.
4. Fixed and variable non-media acquisition costs are deducted before Maximum Media CAC is calculated.
5. Maximum CPL is based on Media Budget Headroom divided by Required Leads.
6. Negative acquisition/media headroom fails closed with explicit reasons.
7. Exactly zero acquisition/media headroom remains a valid zero result.
8. Structured headroom and mandatory-cost components are returned for auditability.
9. Known numerical tests lock Revenue, Net Profit, and Net Profit Margin examples plus no-headroom boundaries.
10. The Task 31 `.mts` regression test is included in TypeScript checking.
11. The Task 29 Target Engine delegates sustainable CAC/CPL calculations to Task 31 rather than duplicating them.
