# Task 28 — Insight Prioritization — Top 3

## Purpose

Task 28 turns Task 27 candidate observations into Mizan's final short decision set:

**أهم 3 ملاحظات**

The result must be deterministic, stable, and limited to three observations. The prioritizer does not create new business conclusions; it only orders and deduplicates conclusions already produced by Task 27.

## Locked priority order for V1

The ordinal priority reflects Mizan's product priorities and the difference between direct financial harm and lower-level symptoms:

1. **Unhealthy growth** — Net Cash rises while Real Net Profit falls.
2. **Healthy funnel conversion with negative Lifetime Contribution Profit** — conversion is functioning but customer economics destroy contribution value.
3. **Non-media cost pressure** — Media CAC is unchanged while Ultimate CAC rises.
4. **Funnel attendance bottleneck** — a funnel-level leak with healthy closing but weak attendance.
5. **Rising Ultimate CAC with positive Lifetime Contribution Profit** — contextual guardrail telling the user not to overreact to CAC in isolation.

These numbers are ordinal ranks only. They are not financial thresholds, scores, percentages, or estimates of monetary impact.

## Root-cause deduplication

Before applying the three-item cap, the prioritizer removes duplicate root-cause observations.

Examples:

- a non-media Ultimate CAC warning and a lower-priority “lifetime economics still support rising CAC” context observation share the `ultimate-cac` root cause; the higher-priority warning wins,
- multiple funnels with the same attendance-root-cause observation produce one representative attendance insight in the Top-3 output,
- multiple healthy funnels with the same negative lifetime-economics root cause produce one representative lifetime-economics observation.

This prevents the final three slots from being consumed by several variations of the same underlying issue.

## Deterministic ordering

The prioritizer sorts independently of input order using:

1. product priority,
2. stable rule ID,
3. stable subject ID,
4. stable insight ID.

Where the product has not defined a numeric severity scale, Task 28 does not invent one. Equal-priority funnel observations therefore use stable IDs for tie-breaking rather than an arbitrary severity formula.

## Hard limit

`MAX_DECISION_INSIGHTS = 3` is a fixed product constraint in V1.

The prioritizer never returns four or more observations.

## Explicitly out of scope

Task 28 does not:

- create new insight rules,
- change financial formulas,
- assign estimated financial impact without a defined calculation,
- use AI to rank observations,
- modify historical data,
- implement Target Planner calculations,
- add database/RLS behavior,
- add UI placement or styling.

## Acceptance criteria

1. Candidate insights are sorted deterministically and independently of caller input order.
2. Profitability harm ranks above lower-level funnel symptoms and contextual guardrails.
3. Duplicate root causes are collapsed before the three-item cap.
4. Output contains at most three observations.
5. Stable ties use rule/subject/insight IDs and do not rely on runtime insertion order.
6. Tests cover more than three candidates, root-cause duplicates, stable ties, and reversed input order.
7. Task 27 rule generation and Task 28 prioritization remain separate reusable modules.
