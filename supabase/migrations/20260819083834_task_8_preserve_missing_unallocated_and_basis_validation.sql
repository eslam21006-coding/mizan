alter table public.monthly_periods
  alter column unallocated_gross_cash_collected drop not null,
  alter column unallocated_gross_cash_collected drop default,
  alter column unallocated_refunds drop not null,
  alter column unallocated_refunds drop default;

create or replace function private.save_monthly_actuals_preserve_missing(
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_period_id uuid;
begin
  saved_period_id := private.save_monthly_actuals(
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

  update public.monthly_periods
  set unallocated_gross_cash_collected = target_unallocated_gross,
      unallocated_refunds = target_unallocated_refunds
  where id = saved_period_id
    and business_id = target_business_id;

  return saved_period_id;
end;
$$;

revoke all on function private.save_monthly_actuals_preserve_missing(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) from public;
revoke all on function private.save_monthly_actuals_preserve_missing(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) from anon;
grant execute on function private.save_monthly_actuals_preserve_missing(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) to authenticated;

create or replace function public.save_monthly_actuals(
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
  select private.save_monthly_actuals_preserve_missing(
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

create or replace function private.validate_monthly_expense_basis()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cost_behavior_snapshot = 'per_customer'
     and new.customer_count_basis is null then
    raise exception 'per-customer expense requires an explicit customer count basis'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_monthly_expense_basis() from public;
revoke all on function private.validate_monthly_expense_basis() from anon;
revoke all on function private.validate_monthly_expense_basis() from authenticated;

drop trigger if exists validate_monthly_expense_basis on public.monthly_expense_entries;
create trigger validate_monthly_expense_basis
  before insert or update of cost_behavior_snapshot, customer_count_basis
  on public.monthly_expense_entries
  for each row execute function private.validate_monthly_expense_basis();
