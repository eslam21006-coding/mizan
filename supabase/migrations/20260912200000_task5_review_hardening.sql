-- Task 5 review hardening after final PR review.
-- 1) An invalid active manual override must be replaceable when the underlying pool is otherwise valid.
-- 2) Copy-previous-month must not mutate an already-existing historical month without an audit trail.
-- 3) Normal historical backfills must serialize the existence decision with the write.

create or replace function public.save_customer_economics_manual_override(
  p_business_id uuid,
  p_authoritative_source_id uuid,
  p_allocations jsonb,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  require_plan_exception boolean := true;
begin
  -- The private validator still enforces authorization, exact-pool reconciliation,
  -- positive/eligible authoritative amount, complete history, and trusted target groups.
  -- The only relaxation here is allowing an already-active *invalid* override to be superseded.
  if exists (
    select 1
    from public.customer_economics_manual_override_status as status
    where status.business_id = p_business_id
      and status.authoritative_source_type = 'monthly_expense_entry'
      and status.authoritative_source_id = p_authoritative_source_id
      and not status.is_valid
  ) then
    require_plan_exception := false;
  end if;

  return private.create_customer_economics_manual_override(
    p_business_id,
    p_authoritative_source_id,
    p_allocations,
    p_reason,
    require_plan_exception
  );
end;
$$;

revoke all on function public.save_customer_economics_manual_override(uuid, uuid, jsonb, text) from public;
revoke all on function public.save_customer_economics_manual_override(uuid, uuid, jsonb, text) from anon;
revoke all on function public.save_customer_economics_manual_override(uuid, uuid, jsonb, text) from authenticated;
grant execute on function public.save_customer_economics_manual_override(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.save_customer_economics_manual_override(uuid, uuid, jsonb, text) to service_role;

-- Keep the original copy implementation behind a private boundary. The public wrapper below
-- owns the historical-period decision and serializes it with the eventual write.
alter function public.copy_previous_month_expenses(uuid, date)
  rename to copy_previous_month_expenses_unchecked;
alter function public.copy_previous_month_expenses_unchecked(uuid, date)
  set schema private;

revoke all on function private.copy_previous_month_expenses_unchecked(uuid, date) from public;
revoke all on function private.copy_previous_month_expenses_unchecked(uuid, date) from anon;
revoke all on function private.copy_previous_month_expenses_unchecked(uuid, date) from authenticated;
revoke all on function private.copy_previous_month_expenses_unchecked(uuid, date) from service_role;

create function public.copy_previous_month_expenses(
  target_business_id uuid,
  target_month_start date
)
returns table(previous_month_found boolean, copied_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_timezone text;
  business_current_month date;
  existing_period boolean;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to copy monthly expenses.';
  end if;

  if not (select private.can_manage_business(target_business_id)) then
    raise insufficient_privilege using message = 'Not allowed to manage monthly actuals for this business.';
  end if;

  if target_month_start is null
     or target_month_start <> date_trunc('month', target_month_start)::date then
    raise invalid_parameter_value using message = 'month_start must be the first day of a calendar month.';
  end if;

  select business.timezone
  into business_timezone
  from public.businesses as business
  where business.id = target_business_id;

  if not found then
    raise invalid_parameter_value using message = 'Business does not exist.';
  end if;

  business_current_month := date_trunc(
    'month',
    now() at time zone business_timezone
  )::date;

  -- This is the same transaction lock used by transaction imports and the monthly save helper.
  -- Holding it before the existence check makes "missing backfill" versus "existing correction"
  -- one serialized decision.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'monthly-customer-counts:' || target_business_id::text,
      0
    )
  );

  select exists (
    select 1
    from public.monthly_periods as period
    where period.business_id = target_business_id
      and period.month_start = target_month_start
  ) into existing_period;

  if existing_period and target_month_start < business_current_month then
    raise invalid_parameter_value using message = 'Existing historical months require the explicit historical correction workflow.';
  end if;

  return query
  select copied.previous_month_found, copied.copied_count
  from private.copy_previous_month_expenses_unchecked(
    target_business_id,
    target_month_start
  ) as copied;
end;
$$;

revoke all on function public.copy_previous_month_expenses(uuid, date) from public;
revoke all on function public.copy_previous_month_expenses(uuid, date) from anon;
revoke all on function public.copy_previous_month_expenses(uuid, date) from authenticated;
grant execute on function public.copy_previous_month_expenses(uuid, date) to authenticated;
grant execute on function public.copy_previous_month_expenses(uuid, date) to service_role;

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_timezone text;
  business_current_month date;
  existing_period boolean;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to save monthly actuals.';
  end if;

  if not (select private.can_manage_business(target_business_id)) then
    raise insufficient_privilege using message = 'Not allowed to manage monthly actuals for this business.';
  end if;

  select business.timezone
  into business_timezone
  from public.businesses as business
  where business.id = target_business_id;

  if not found then
    raise invalid_parameter_value using message = 'Business does not exist.';
  end if;

  if target_month_start is null
     or target_month_start <> date_trunc('month', target_month_start)::date then
    raise invalid_parameter_value using message = 'month_start must be the first day of a calendar month.';
  end if;

  business_current_month := date_trunc(
    'month',
    now() at time zone business_timezone
  )::date;

  -- Acquire the same lock used inside private.save_monthly_actuals_preserve_missing *before*
  -- checking whether the historical month exists. A concurrent first-time backfill therefore
  -- cannot turn a second normal save into an unaudited ON CONFLICT update.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'monthly-customer-counts:' || target_business_id::text,
      0
    )
  );

  select exists (
    select 1
    from public.monthly_periods as period
    where period.business_id = target_business_id
      and period.month_start = target_month_start
  ) into existing_period;

  if existing_period and target_month_start < business_current_month then
    raise invalid_parameter_value using message = 'Existing historical months require the explicit historical correction workflow.';
  end if;

  return private.save_monthly_actuals_preserve_missing(
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
end;
$$;

revoke all on function public.save_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) from public;
revoke all on function public.save_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) from anon;
revoke all on function public.save_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) from authenticated;
grant execute on function public.save_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) to authenticated;
grant execute on function public.save_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) to service_role;

comment on function public.copy_previous_month_expenses(uuid, date) is
  'Copies prior-month expense inputs only when doing so cannot mutate an already-existing historical month outside the audited correction workflow.';
comment on function public.save_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) is
  'Normal monthly save path. Existing historical months require audited correction; first-time historical backfills serialize the existence decision with the write.';
