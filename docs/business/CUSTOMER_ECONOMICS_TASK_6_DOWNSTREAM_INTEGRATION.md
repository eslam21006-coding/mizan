# Customer Economics Task 6 — Downstream Integration & Final Regression

## Purpose

Task 6 connects the completed Customer Economics engine to downstream product surfaces without redefining any financial metric.

The only new runtime integration is the deterministic Decision Engine. Target Planner and Simulator remain based on their existing authoritative monthly inputs.

## Decision Engine Customer Economics signal

The existing Decision Engine already contains two locked rules that require Lifetime Contribution Profit:

1. rising Ultimate CAC + positive Lifetime Contribution Profit → do not automatically classify acquisition as unhealthy;
2. healthy funnel conversion + negative Lifetime Contribution Profit → investigate customer lifetime economics.

Before Task 6, those rules were permanently blocked because the Decision Engine loader did not supply Customer Economics evidence.

Task 6 supplies a **decision-only as-of-month signal** built from `customer_lifetime_contribution_profit_observations`.

For the selected Decision Engine month:

- load only rows whose `observation_month` equals that selected month;
- each acquisition group contributes its Lifetime Contribution Profit observed up to that cutoff;
- acquisition groups are disjoint because every customer belongs to one first-purchase month;
- sum the group Lifetime Contribution Profit values exactly, using decimal arithmetic with no floating-point conversion;
- use only the sign of that aggregate for the already-approved Decision Engine rules.

This aggregate is **not a new LTV metric**, is not displayed as a standalone business Lifetime Contribution Profit KPI, and is not a forecast.

## Quality propagation

The downstream signal fails closed:

- no acquisition-group observations → `missing`;
- any acquisition group is `incomplete` → the aggregate is unavailable and `incomplete`;
- duplicate acquisition groups, malformed ready values, missing currency, or mixed currencies → `conflict`;
- all groups `actual` → ready / actual;
- at least one group `estimated` and none incomplete → ready / estimated.

Estimated Customer Economics may support the deterministic rule because the underlying customer cash is actual and the cost allocation is a declared deterministic estimate. The founder-facing insight UI must explicitly disclose that estimate whenever a visible customer-economics insight depends on it.

Missing or incomplete Customer Economics is never treated as zero.

## Historical integrity

The Decision Engine query is pinned to the selected `observation_month` rather than using the latest current snapshot. Reviewing an older month therefore cannot use future customer cash or future cost allocations.

## Target Planner boundary

Task 6 does not feed Observed LTV or Lifetime Contribution Profit into Target Planner.

Target Planner continues to reverse-engineer targets from authoritative monthly business economics and the existing Rolling-3 actual basis. Realized historical lifetime value is not silently converted into a predicted future customer value.

## Simulator boundary

Task 6 does not replace the Simulator's `customer_value` baseline with Observed LTV or Lifetime Contribution Profit.

The existing baseline remains monthly Net Cash Collected ÷ New Customers. Upsells, renewals, and backend revenue remain explicit scenario controls. Scenario changes continue to leave historical actuals untouched.

## Acceptance criteria

1. Task 5 is merged before Task 6 starts.
2. Decision Engine loads Customer Economics from the reconciled observation surface.
3. Customer Economics is scoped to the selected Decision Engine observation month with no future look-ahead.
4. Acquisition-group Lifetime Contribution Profit values are summed exactly.
5. Any incomplete group blocks the downstream judgment.
6. Missing observations remain missing, never zero.
7. Currency/duplicate/malformed conflicts fail closed.
8. Estimated evidence is explicitly disclosed in Arabic when a visible customer-economics insight uses it.
9. Existing Decision Engine thresholds, rule wording, prioritization, and Top-3 cap remain unchanged.
10. Target Planner does not consume Observed LTV or Lifetime Contribution Profit.
11. Simulator does not consume Observed LTV or Lifetime Contribution Profit as its baseline.
12. Numerical tests cover exact aggregation and quality propagation.
13. Browser verification covers Arabic RTL, estimated disclosure, 390px mobile width, horizontal overflow, and console/page errors.
14. Full existing calculation, database-security, build, and browser regression suites remain green.
