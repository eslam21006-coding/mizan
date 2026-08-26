# Task 27 — Rule-Based Insights V1

## Purpose

Task 27 converts verified Mizan metrics into a small set of deterministic business observations.

It does not use AI to guess causes. Every conclusion must be supported by locked Mizan metrics and must pass the Task 26 Data Quality Engine first.

If a rule does not have enough trustworthy data, it does not manufacture a conclusion. The standard fallback remains:

**البيانات غير كافية للحكم**

## V1 rule set

### 1. Funnel attendance bottleneck

Trigger for a specific funnel only when:

- Show Rate is strictly less than 65%, and
- Close Rate is strictly greater than 20%.

Conclusion: attendance is likely the bigger bottleneck before trying to improve closing.

Boundary behavior is intentional:

- exactly 65% Show Rate does not trigger this rule,
- exactly 20% Close Rate does not trigger this rule.

This follows the locked product example and avoids converting strict thresholds into inclusive thresholds.

### 2. Unhealthy growth

Trigger when, versus the previous period:

- Net Cash Collected increases, and
- Real Net Profit decreases.

Conclusion: growth is financially unhealthy and costs should be reviewed before increasing spend.

The rule uses Net Cash Collected, not contracted future revenue.

### 3. Non-media cost pressure

Trigger when, versus the previous period:

- Media CAC is exactly unchanged,
- Ultimate CAC increases, and
- the Task 26 ad-spend reconciliation signal is ready.

Conclusion: investigate non-media costs rather than blaming ad efficiency automatically.

For V1, **stable Media CAC means exactly unchanged**. No arbitrary tolerance such as ±5% is invented. A tolerance band can only be added later after the product defines one explicitly.

Ultimate CAC remains the Mizan custom metric: **التكلفة الكاملة للبزنس لكل عميل جديد**. It is not presented as traditional CAC.

### 4. Rising Ultimate CAC with supportive lifetime economics

Trigger when:

- Ultimate CAC increases versus the previous period, and
- Lifetime Contribution Profit is positive.

Conclusion: do not automatically classify acquisition as unhealthy from the cost increase alone because lifetime customer economics remain contribution-positive.

This rule intentionally uses positive Lifetime Contribution Profit rather than inventing an undefined threshold for “strong LTV.”

### 5. Healthy funnel conversion with weak lifetime economics

Trigger for a funnel when:

- Show Rate is strictly greater than 65%,
- Close Rate is strictly greater than 20%, and
- Lifetime Contribution Profit is negative.

Conclusion: the funnel’s attendance and closing are healthy, but customer economics are weak. Investigate upsells, renewals, backend revenue, pricing, and retention.

This wording does not claim that the entire business acquisition system is healthy merely because one funnel passes the two funnel benchmarks.

## Data-quality gating

Every rule declares the Task 26 signals it requires.

If any required signal is missing, attribution-incomplete, blocked by a known-zero denominator, conflicting, incomplete, or otherwise not ready, the rule evaluation is `insufficient` and no business conclusion is created.

The engine preserves three distinct evaluation states:

- `matched` — sufficient data and the deterministic predicate is true,
- `not_matched` — sufficient data and the predicate is false,
- `insufficient` — the predicate cannot be judged from trustworthy data.

## Arabic output

V1 insight titles and messages are written in simple Arabic suitable for the Arabic-first Mizan UI. The engine returns structured evidence codes alongside the Arabic explanation so future UI and audit layers can show why a conclusion was generated.

## Explicitly out of scope

Task 27 does not implement:

- AI-generated recommendations,
- arbitrary “high CAC,” “strong LTV,” or “weak LTV” thresholds,
- a Media CAC stability tolerance,
- statistical forecasting,
- target reverse engineering,
- simulator changes,
- database schema or RLS changes,
- UI placement or styling,
- ranking more than the rule’s own product-priority metadata.

Task 28 owns final Top-3 prioritization and deduplication.

## Acceptance criteria

1. Rules are centralized in a pure deterministic business module.
2. Task 26 readiness gates every rule before a conclusion is produced.
3. Show Rate <65% with Close Rate >20% produces the attendance-bottleneck observation.
4. Exactly 65% Show Rate or exactly 20% Close Rate does not trigger that observation.
5. Net Cash up with Real Net Profit down produces the unhealthy-growth observation.
6. Exact-flat Media CAC with rising Ultimate CAC and clean reconciliation produces the non-media-cost observation.
7. Any Media CAC change does not count as “stable” in V1.
8. Rising Ultimate CAC with positive Lifetime Contribution Profit produces a contextual guardrail rather than an acquisition-health condemnation.
9. A funnel above both conversion benchmarks with negative Lifetime Contribution Profit produces a customer-economics warning.
10. Insufficient data produces no fabricated insight and preserves **البيانات غير كافية للحكم**.
11. Numerical tests use known inputs and exact outputs/boundaries.
12. No Task 29 Target Engine work is included.
