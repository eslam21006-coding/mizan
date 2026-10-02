# B10 — Read-only compatibility audit and release gate

## Repository audit (confirmed on merged B09)

- `src/lib/business/setup-loader.ts` formerly treated **any** `monthly_periods` row as first-month readiness, even if financial columns were NULL.
- `src/app/(app)/businesses/[businessId]/page.tsx` loads Overview independently of the four-step Setup route. Tightening Setup readiness must not delete monthly records or redirect established businesses away from Overview.
- The existing `save_monthly_actuals` function already provides a unique business/month period, unique period/item rows, atomic writes and database-level business-management checks.
- The new readiness evaluator checks all required, actually saved financial values. Historical inactive rows remain applicable when they have saved snapshots; current items created after the original month was saved must not retroactively invalidate it.

## Live-data audit status — BLOCKED

The connected Mizan Supabase project reports `ACTIVE_HEALTHY`, but two separate read-only SQL attempts on 2026-10-02 failed with PostgreSQL `28P01` (password authentication failed for `postgres`). Consequently, the existing-business population and potential changes to Step 4 completion **have not been measured**. Do not infer that there are no affected businesses.

Do **not** modify production data, deploy a readiness change, or claim production compatibility before a successful read-only audit. No migration has been applied.

### Safe aggregate impact query (execute after SQL access is repaired)

```sql
WITH assessed AS (
 SELECT p.id, p.business_id, p.month_start,
   p.new_customers IS NOT NULL AND p.total_paying_customers IS NOT NULL AS customers_confirmed,
   coalesce(r.required_count,0) AS source_count,
   coalesce(r.incomplete_count,0) AS incomplete_sources,
   coalesce(e.incomplete_count,0) AS incomplete_expenses
 FROM public.monthly_periods p
 LEFT JOIN LATERAL (
   SELECT count(*) AS required_count,
          count(*) FILTER (WHERE mr.gross_cash_collected IS NULL OR mr.refunds IS NULL) AS incomplete_count
   FROM public.revenue_streams rs
   LEFT JOIN public.monthly_revenue_entries mr
     ON mr.monthly_period_id = p.id AND mr.revenue_stream_id = rs.id
   WHERE rs.business_id = p.business_id
     AND ((rs.is_active AND rs.created_at <= p.created_at) OR mr.id IS NOT NULL)
 ) r ON TRUE
 LEFT JOIN LATERAL (
   SELECT count(*) FILTER (
     WHERE me.input_value IS NULL OR
       (coalesce(me.cost_behavior_snapshot, ei.cost_behavior) = 'per_customer'
         AND me.customer_count_basis IS NULL)
   ) AS incomplete_count
   FROM public.expense_items ei
   LEFT JOIN public.monthly_expense_entries me
     ON me.monthly_period_id = p.id AND me.expense_item_id = ei.id
   WHERE ei.business_id = p.business_id
     AND ((ei.is_active AND ei.created_at <= p.created_at) OR me.id IS NOT NULL)
 ) e ON TRUE
),
per_business AS (
 SELECT business_id, bool_or(
   customers_confirmed AND source_count > 0
   AND incomplete_sources = 0 AND incomplete_expenses = 0
 ) AS has_complete_month
 FROM assessed GROUP BY business_id
)
SELECT
  (SELECT count(*) FROM public.businesses) AS business_count,
  (SELECT count(*) FROM assessed) AS saved_month_count,
  (SELECT count(*) FROM assessed
    WHERE customers_confirmed AND source_count > 0
      AND incomplete_sources = 0 AND incomplete_expenses = 0) AS complete_month_count,
  count(*) AS businesses_with_saved_month,
  count(*) FILTER (WHERE has_complete_month) AS businesses_with_complete_month,
  count(*) FILTER (WHERE NOT has_complete_month) AS previously_saved_but_incomplete_businesses
FROM per_business;
```

### Decision gate

1. Run the query successfully in read-only mode and record aggregate counts only; do not export customers or financial rows.
2. Confirm that legacy businesses keep existing Overview, Monthly and history access, even if Setup Step 4 now requests more complete data.
3. Where preexisting periods contain partial inputs, show an explicit needs-review state without altering the records.
4. If historical item-activation state cannot be inferred from saved snapshots and timestamps with acceptable confidence, stop and propose a separate minimal verification migration before B10 merge.
5. Repeat a read-only audit against any production migration changes immediately before deployment.

The B10 branch is safe to develop and test without a production migration, but its production compatibility check remains a release blocker until this query succeeds.
