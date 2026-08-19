alter function public.save_monthly_actuals(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) set schema private;

alter function public.copy_previous_month_expenses(uuid, date)
  set schema private;

revoke all on function private.save_monthly_actuals(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) from public;
revoke all on function private.save_monthly_actuals(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) from anon;
revoke all on function private.save_monthly_actuals(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) from authenticated;
grant execute on function private.save_monthly_actuals(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) to authenticated;

revoke all on function private.copy_previous_month_expenses(uuid, date) from public;
revoke all on function private.copy_previous_month_expenses(uuid, date) from anon;
revoke all on function private.copy_previous_month_expenses(uuid, date) from authenticated;
grant execute on function private.copy_previous_month_expenses(uuid, date) to authenticated;

create function public.save_monthly_actuals(
  target_business_id uuid,
  target_month_start date,
  target_new_customers integer,
  target_total_paying_customers integer,
  target_unallocated_gross numeric,
  target_unallocated_refunds numeric,
  target_adjustment_note text,
  target_revenue_entries jsonb,
  target_expense_entries jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.save_monthly_actuals(
    target_business_id,
    target_month_start,
    target_new_customers,
    target_total_paying_customers,
    target_unallocated_gross,
    target_unallocated_refunds,
    target_adjustment_note,
    target_revenue_entries,
    target_expense_entries
  );
$$;

revoke all on function public.save_monthly_actuals(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) from public;
revoke all on function public.save_monthly_actuals(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) from anon;
grant execute on function public.save_monthly_actuals(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) to authenticated;

create function public.copy_previous_month_expenses(
  target_business_id uuid,
  target_month_start date
)
returns table(previous_month_found boolean, copied_count integer)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.copy_previous_month_expenses(target_business_id, target_month_start);
$$;

revoke all on function public.copy_previous_month_expenses(uuid, date) from public;
revoke all on function public.copy_previous_month_expenses(uuid, date) from anon;
grant execute on function public.copy_previous_month_expenses(uuid, date) to authenticated;

create index monthly_revenue_entries_business_stream_idx
  on public.monthly_revenue_entries (business_id, revenue_stream_id);

create index monthly_expense_entries_business_expense_idx
  on public.monthly_expense_entries (business_id, expense_item_id);
