# Task 30 — Funnel Reverse Engineering

## Purpose

Task 30 owns the reusable funnel-volume calculation used by the Target Planner.

Task 29 determines how many new customers are required for the selected financial target. Task 30 takes that customer requirement plus explicit funnel conversion assumptions and works backward to the operational volumes required upstream.

There is one formula path. `planTarget` delegates to `reverseEngineerFunnel`; the Target Engine does not maintain a second copy of these formulas.

## Inputs

- Required New Customers
- Sale-to-New-Customer Rate
- Close Rate
- Qualification Rate
- Show Rate
- Booking Rate

Every rate is an exact ratio and must satisfy:

`0% < rate <= 100%`

Missing or zero rates are not replaced with guessed assumptions.

## Calculation order

The calculation works backward stage by stage:

1. `Required Sales = ceil(Required Customers / Sale-to-New-Customer Rate)`
2. `Required Qualified Calls = ceil(Required Sales / Close Rate)`
3. `Required Shows = ceil(Required Qualified Calls / Qualification Rate)`
4. `Required Bookings = ceil(Required Shows / Show Rate)`
5. `Required Leads = ceil(Required Bookings / Booking Rate)`

The ceiling is applied **at each stage before calculating the preceding stage**. This is required because customers, sales, calls, bookings, and leads are indivisible operational counts.

## Known numerical example

Inputs:

- Required Customers = 50
- Sale-to-New-Customer Rate = 5/6
- Close Rate = 40%
- Qualification Rate = 75%
- Show Rate = 80%
- Booking Rate = 50%

Expected:

- Required Sales = 60
- Required Qualified Calls = 150
- Required Shows = 200
- Required Bookings = 250
- Required Leads = 500

Rounding example with Required Customers = 59:

- Required Sales = 71
- Required Qualified Calls = 178
- Required Shows = 238
- Required Bookings = 298
- Required Leads = 596

These results prove that stage-by-stage ceiling is used rather than applying one final rounding operation.

## Validation and failure behavior

- Required Customers must be a positive safe integer.
- Each rate must be represented by integer numerator/denominator parts.
- Numerator and denominator must both be positive.
- A rate above 100% is rejected.
- A zero rate is rejected rather than producing Infinity or inventing a conversion assumption.
- If any required upstream count would exceed JavaScript's safe integer boundary, the calculation fails closed.

## Explicitly out of scope

Task 30 does not:

- determine how many customers are required for a financial target,
- calculate sustainable CAC/CPL,
- create or change funnel historical actual data,
- invent benchmark conversion rates,
- add UI,
- add database/RLS behavior,
- implement simulator scenarios.

## Acceptance criteria

1. Funnel reverse engineering exists in one reusable pure calculation module.
2. Required Customers, Sales, Qualified Calls, Shows, Bookings, and Leads are returned explicitly.
3. Every upstream stage uses exact arithmetic and an upward ceiling before the next stage.
4. Conversion rates must be greater than 0% and no greater than 100%.
5. Zero/invalid rates fail closed instead of producing a fabricated plan.
6. Safe-integer overflow fails closed.
7. Known numerical tests lock the 50-customer and 59-customer examples.
8. 100% conversion is supported as a valid boundary.
9. The Task 30 `.mts` regression test is included in TypeScript checking.
10. The Task 29 Target Engine delegates funnel-volume calculations to Task 30 rather than duplicating them.
