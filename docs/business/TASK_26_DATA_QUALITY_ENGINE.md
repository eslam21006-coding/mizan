# Task 26 — Data Quality Engine

## Purpose

Task 26 is the first task in the Decision Engine phase. It determines whether available Mizan data is trustworthy and sufficient to support a deterministic conclusion.

It does **not** generate business insights. Task 27 owns rule logic and Task 28 owns Top-3 prioritization.

The locked product fallback for an unsupported conclusion is:

**البيانات غير كافية للحكم**

A data-quality warning must never be silently converted into a deterministic business conclusion.

## Source-of-truth rules

This engine consumes the already-validated results produced by Mizan's existing financial/funnel engines and explicit customer-economics readiness signals.

It does not redefine any financial formula.

It preserves the Task 1 distinction between:

- a known zero,
- a missing value,
- missing attribution,
- a known value that cannot support a ratio,
- a reconciliation conflict,
- incomplete customer-economics data.

## Data domains covered

### Whole-business economics

Current and previous periods expose readiness for:

- Gross Cash Collected
- Refunds
- Net Cash Collected
- New Customers
- Total Paying Customers
- Returning Customers
- All Business Costs
- Variable Costs
- Real Net Profit
- Real Net Profit Margin
- Contribution Profit
- Contribution Margin
- Media CAC
- Acquisition CAC
- Ultimate CAC
- Revenue Per Paying Customer
- Revenue Per New Customer
- MER
- ROAS

Existing `CalculatedMetric` unavailable reasons are mapped into explicit data-quality states rather than coerced into zero.

### Ad-spend reconciliation

The engine treats:

- `matched` as ready,
- `business_only` as ready because the explicit business Total Ad Spend remains canonical,
- `funnel_only` as ready when the existing reconciliation engine has a complete funnel roll-up,
- `mismatch` as a blocking conflict,
- `incomplete` as incomplete data.

A future ad-dependent decision rule must explicitly depend on the reconciliation signal if it needs a conflict-free ad-spend basis.

### Funnel economics

Each funnel gets independent readiness signals for:

- CPL
- Cost per Booking
- Cost per Show
- Cost per Qualified Call
- Show Rate
- Qualification Rate
- Close Rate
- Lead-to-Sale Rate
- Media CAC
- ROAS

A funnel with zero booked calls, for example, produces a `known_zero` Show Rate blocker. That is different from a missing Booked Calls input.

### Customer economics

Task 26 defines explicit readiness signals for:

- Observed LTV
- Backend Lifetime Revenue
- Lifetime Revenue Attribution
- Lifetime Contribution Profit

The data loaders that already own those datasets remain responsible for determining whether the corresponding dataset is ready, missing, incomplete, attribution-incomplete, or conflicting. Task 26 normalizes that state for future decision rules.

## Dependency evaluation

Task 26 provides a generic dependency evaluator.

A future deterministic rule declares:

- `requiredAll`: every named signal must be ready,
- `requiredAny`: at least one signal in each alternative group must be ready.

If any required dependency cannot support the rule, the evaluator returns the exact fallback:

**البيانات غير كافية للحكم**

This keeps Task 27 from manufacturing missing values or treating a data-quality warning as evidence.

## Readiness summary

For a set of rule dependencies:

- `ready`: every declared dependency is supportable,
- `partial`: at least one is supportable and at least one is blocked,
- `insufficient`: none is supportable.

This is a data-readiness classification only. It is not a business-health score.

## Explicitly out of scope

Task 26 does not implement:

- Show Rate / Close Rate bottleneck conclusions,
- Media CAC vs Ultimate CAC trend conclusions,
- revenue-vs-profit conclusions,
- CAC/LTV/backend conclusions,
- healthy/unhealthy thresholds beyond the existing metric engines,
- ranking or Top-3 insight prioritization,
- AI-generated recommendations,
- database schema changes,
- new RLS policies,
- new UI.

Those belong to later roadmap tasks.

## Acceptance criteria

1. One reusable centralized Data Quality Engine exists under `src/lib/business`.
2. Missing and zero remain distinct states.
3. Missing attribution remains distinct from generic missing input.
4. Non-positive Net Cash ratio boundaries remain known-value blockers rather than missing data.
5. Business/funnel ad-spend mismatch is exposed as a blocking conflict.
6. Current and previous business periods can be assessed independently.
7. Funnel readiness is isolated per funnel.
8. Customer-economics readiness can represent Observed LTV, backend revenue, attribution completeness, and Lifetime Contribution Profit.
9. Dependency evaluation supports both all-required and any-of requirements.
10. Unsupported dependencies return **البيانات غير كافية للحكم**.
11. Automated tests cover complete, partial, missing, known-zero, attribution-missing, non-positive-Net-Cash, and ad-spend-conflict cases.
12. Task 27/28 behavior is not implemented in this PR.
