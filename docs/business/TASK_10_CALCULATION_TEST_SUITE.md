# Task 10 — Calculation Test Suite

## Purpose

Task 10 hardens the Task 9 Core Financial Calculation Engine with direct automated numerical regression coverage.

This task does not add product features or redefine financial logic. `docs/CALCULATION_SPEC.md` remains authoritative, and `src/lib/business/calculations.ts` remains the production implementation under test.

## Acceptance criteria

Task 10 is complete only when automated tests prove known inputs produce the locked expected outputs for the implemented core engine.

Coverage must include:

- Gross Cash Collected;
- Refunds;
- Net Cash Collected;
- New Customers, Total Paying Customers, and Returning Customers;
- all four expense categories;
- all three expense behaviors;
- explicit Per Customer count bases;
- percentage expenses using `rate × max(Net Cash Collected, 0)`;
- Variable Costs determined by behavior rather than category;
- All Business Costs;
- Real Net Profit;
- Real Net Profit Margin;
- Contribution Profit;
- Contribution Margin;
- Media CAC;
- Acquisition CAC;
- Ultimate CAC;
- Revenue Per Paying Customer;
- Revenue Per New Customer;
- MER;
- ROAS attribution rules;
- exact decimal arithmetic and exact reduced ratios;
- missing-versus-zero propagation;
- denominator-specific unavailable reasons;
- refund-heavy negative-Net-Cash periods;
- invalid customer-count and expense-shape guards;
- negative/non-canonical raw input rejection.

Compilation alone is not sufficient verification for this financial task.

## Locked Task 1 examples now executed against production logic

`test/business/core-calculations.locked-examples.test.mts` ports the core-business examples from the locked Task 1 calculation specification into direct tests of `calculateCoreFinancials()`.

### Example A — Full business month

Known inputs:

- Gross Cash: 100,000
- Refunds: 5,000
- New Customers: 50
- Total Paying Customers: 80
- Canonical Ad Spend: 20,000
- Attributed Revenue: 60,000

Known outputs include:

- Net Cash: 95,000
- Acquisition Costs: 34,500
- Fulfillment Costs: 14,350
- Financial Costs: 7,600
- All Business Costs: 66,450
- Real Net Profit: 28,550
- Ultimate CAC: 1,329
- Variable Costs: 23,450
- Contribution Profit: 71,550
- MER: 4.75
- ROAS: 3.0

The test asserts the engine's exact decimal strings and reduced fractions rather than approximate JavaScript floating-point results.

### Example B — Refund-heavy month

The suite proves:

- Net Cash can be negative;
- percentage expenses floor their base at zero and do not create inferred credits;
- Real Net Profit can be negative;
- Real Net Profit Margin and Contribution Margin become unavailable with `NON_POSITIVE_NET_CASH`;
- valid customer-value and MER ratios may remain negative when their own denominators are valid.

### Example C — No new customers

The suite proves Media CAC, Acquisition CAC, Ultimate CAC, and Revenue Per New Customer return `NO_NEW_CUSTOMERS` rather than `Infinity`, `NaN`, or zero.

### Example D — Zero ad spend

The suite proves:

- Media CAC may validly equal zero when New Customers is positive;
- MER returns `NO_AD_SPEND`;
- ROAS returns `NO_AD_SPEND` when attribution exists but Ad Spend is zero.

### Example E — Attribution unavailable

The suite proves business Net Cash is never substituted for Attributed Revenue. MER can remain available while ROAS returns `ATTRIBUTION_UNAVAILABLE`.

## Edge-case matrix

`test/business/core-calculations.edge-cases.test.mts` adds direct regression coverage beyond the examples:

- decimal values such as `0.1 + 0.2` remain exact;
- 12-decimal percentage rates do not lose precision;
- Per Customer expenses independently honor `new_customers` and `total_paying_customers` bases;
- variable-cost classification follows behavior, not category;
- a missing Fixed Monthly expense blocks Real Net Profit but does not block Contribution Profit when all variable costs are known;
- a missing variable expense blocks both contribution and all-cost profitability outputs;
- missing revenue/refund/unallocated components propagate as unavailable rather than implicit zero;
- denominator rules take precedence when the locked specification says they determine the result;
- missing customer counts only block calculations that actually depend on those counts;
- negative attributed revenue is allowed when real attribution exists after attributable refunds;
- exact ratios are reduced and trailing decimal zeroes normalize;
- invalid expense basis combinations fail closed;
- negative monetary inputs, unsafe/fractional/negative counts, and non-canonical decimal notation fail closed;
- unsupported runtime expense category/behavior values fail closed even if TypeScript typing is bypassed.

## Explicitly deferred

Task 1 examples F–K are not ported into the Task 9 engine test suite because their production features do not yet exist:

- funnel metrics and benchmark rules;
- self-liquidating funnel economics;
- combined-period aggregation;
- Observed LTV cohorts;
- Lifetime Contribution Profit.

Those examples must become direct production-logic regression tests when their respective implementation tasks are built. Task 10 must not create placeholder production implementations for future features merely to make those examples executable.

## Merge gate

Before merge:

1. all calculation tests pass;
2. full repository CI passes;
3. CodeRabbit has zero unresolved actionable comments;
4. any failure uncovered by these tests is fixed and re-verified before approval;
5. founder explicitly approves the Task 10 merge.
