-- Canonicalize the two monthly-period money values captured in historical correction audit JSON.
-- PostgreSQL NUMERIC preserves declared scale when converted directly to JSONB (for example,
-- 100.00000000). The financial value is exact either way, but canonical scale makes immutable
-- before/after audit snapshots stable and readable without changing any monetary semantics.
create or replace function private.monthly_actual_snapshot(
  p_business_id uuid,
  p_monthly_period_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'period',
      to_jsonb(period)
      || jsonb_build_object(
        'unallocated_gross_cash_collected',
          case
            when period.unallocated_gross_cash_collected is null then null::jsonb
            else to_jsonb(pg_catalog.trim_scale(period.unallocated_gross_cash_collected))
          end,
        'unallocated_refunds',
          case
            when period.unallocated_refunds is null then null::jsonb
            else to_jsonb(pg_catalog.trim_scale(period.unallocated_refunds))
          end
      ),
    'revenue_entries', coalesce((
      select jsonb_agg(to_jsonb(revenue_entry) order by revenue_entry.id)
      from public.monthly_revenue_entries as revenue_entry
      where revenue_entry.business_id = p_business_id
        and revenue_entry.monthly_period_id = p_monthly_period_id
    ), '[]'::jsonb),
    'expense_entries', coalesce((
      select jsonb_agg(to_jsonb(expense_entry) order by expense_entry.id)
      from public.monthly_expense_entries as expense_entry
      where expense_entry.business_id = p_business_id
        and expense_entry.monthly_period_id = p_monthly_period_id
    ), '[]'::jsonb)
  )
  from public.monthly_periods as period
  where period.id = p_monthly_period_id
    and period.business_id = p_business_id;
$$;

revoke all on function private.monthly_actual_snapshot(uuid, uuid) from public;
revoke all on function private.monthly_actual_snapshot(uuid, uuid) from anon;
revoke all on function private.monthly_actual_snapshot(uuid, uuid) from authenticated;
revoke all on function private.monthly_actual_snapshot(uuid, uuid) from service_role;

comment on function private.monthly_actual_snapshot(uuid, uuid) is
  'Builds immutable historical-correction audit snapshots with canonical exact NUMERIC money representation.';