create table public.business_transaction_history_status (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  is_complete boolean not null default false,
  confirmed_at timestamptz,
  confirmed_by_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint business_transaction_history_confirmation_consistency check (
    (is_complete and confirmed_at is not null)
    or (not is_complete and confirmed_at is null and confirmed_by_user_id is null)
  )
);

insert into public.business_transaction_history_status (business_id, is_complete)
select business.id, false
from public.businesses as business
on conflict (business_id) do nothing;

alter table public.business_transaction_history_status enable row level security;

revoke all on public.business_transaction_history_status from public;
revoke all on public.business_transaction_history_status from anon;
revoke all on public.business_transaction_history_status from authenticated;
grant select on public.business_transaction_history_status to authenticated;
grant all on public.business_transaction_history_status to service_role;

create policy business_transaction_history_status_select
on public.business_transaction_history_status for select
to authenticated
using ((select private.can_read_business(business_id)));

create or replace function private.initialize_business_transaction_history_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_transaction_history_status (business_id, is_complete)
  values (new.id, false)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

revoke all on function private.initialize_business_transaction_history_status() from public;
revoke all on function private.initialize_business_transaction_history_status() from anon;
revoke all on function private.initialize_business_transaction_history_status() from authenticated;

drop trigger if exists initialize_business_transaction_history_status on public.businesses;
create trigger initialize_business_transaction_history_status
  after insert on public.businesses
  for each row execute function private.initialize_business_transaction_history_status();

create or replace function private.refresh_monthly_customer_counts_for_business(
  target_business_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  history_complete boolean := false;
begin
  select status.is_complete
  into history_complete
  from public.business_transaction_history_status as status
  where status.business_id = target_business_id;

  history_complete := coalesce(history_complete, false);

  with positive_collections as (
    select transaction.customer_email, transaction.transaction_date
    from public.customer_transactions as transaction
    where transaction.business_id = target_business_id
      and transaction.normalized_outcome = 'successful'
      and transaction.transaction_type = 'collection'
      and transaction.amount_collected > 0
  ),
  first_collection as (
    select
      collection.customer_email,
      min(collection.transaction_date) as acquisition_date
    from positive_collections as collection
    group by collection.customer_email
  ),
  monthly_counts as (
    select
      date_trunc('month', collection.transaction_date)::date as month_start,
      count(distinct collection.customer_email)::integer as total_paying_customers,
      count(distinct collection.customer_email) filter (
        where date_trunc('month', acquired.acquisition_date)::date
          = date_trunc('month', collection.transaction_date)::date
      )::integer as new_customers
    from positive_collections as collection
    join first_collection as acquired using (customer_email)
    group by date_trunc('month', collection.transaction_date)::date
  ),
  resolved_period_counts as (
    select
      period.id,
      case
        when history_complete then coalesce(counts.new_customers, 0)
        else period.new_customers
      end as new_customers,
      case
        when counts.month_start is not null then counts.total_paying_customers
        when history_complete then 0
        else period.total_paying_customers
      end as total_paying_customers
    from public.monthly_periods as period
    left join monthly_counts as counts
      on counts.month_start = period.month_start
    where period.business_id = target_business_id
      and (history_complete or counts.month_start is not null)
  )
  update public.monthly_periods as period
  set
    new_customers = resolved.new_customers,
    total_paying_customers = resolved.total_paying_customers
  from resolved_period_counts as resolved
  where period.id = resolved.id;
end;
$$;

revoke all on function private.refresh_monthly_customer_counts_for_business(uuid) from public;
revoke all on function private.refresh_monthly_customer_counts_for_business(uuid) from anon;
revoke all on function private.refresh_monthly_customer_counts_for_business(uuid) from authenticated;
revoke all on function private.refresh_monthly_customer_counts_for_business(uuid) from service_role;

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
  effective_new_customers integer := target_new_customers;
  effective_total_paying_customers integer := target_total_paying_customers;
  derived_new_customers integer;
  derived_total_paying_customers integer;
  history_complete boolean := false;
begin
  if not (select private.can_manage_business(target_business_id)) then
    raise exception 'not allowed to manage monthly actuals for this business'
      using errcode = '42501';
  end if;

  if target_month_start is null
     or target_month_start <> date_trunc('month', target_month_start)::date then
    raise exception 'month_start must be the first day of a calendar month'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'monthly-customer-counts:' || target_business_id::text,
      0
    )
  );

  select status.is_complete
  into history_complete
  from public.business_transaction_history_status as status
  where status.business_id = target_business_id;

  history_complete := coalesce(history_complete, false);

  with positive_collections as (
    select transaction.customer_email, transaction.transaction_date
    from public.customer_transactions as transaction
    where transaction.business_id = target_business_id
      and transaction.normalized_outcome = 'successful'
      and transaction.transaction_type = 'collection'
      and transaction.amount_collected > 0
  ),
  first_collection as (
    select collection.customer_email, min(collection.transaction_date) as acquisition_date
    from positive_collections as collection
    group by collection.customer_email
  ),
  month_payers as (
    select distinct collection.customer_email
    from positive_collections as collection
    where collection.transaction_date >= target_month_start
      and collection.transaction_date < (target_month_start + interval '1 month')::date
  )
  select
    count(*)::integer,
    count(*) filter (
      where acquired.acquisition_date >= target_month_start
        and acquired.acquisition_date < (target_month_start + interval '1 month')::date
    )::integer
  into derived_total_paying_customers, derived_new_customers
  from month_payers as payer
  join first_collection as acquired using (customer_email);

  if history_complete then
    effective_new_customers := derived_new_customers;
    effective_total_paying_customers := derived_total_paying_customers;
  elsif derived_total_paying_customers > 0 then
    if target_new_customers is not null
       and target_new_customers > derived_total_paying_customers then
      raise exception 'manual new customers cannot exceed transaction-derived paying customers for this month'
        using errcode = '22023';
    end if;

    effective_new_customers := target_new_customers;
    effective_total_paying_customers := derived_total_paying_customers;
  else
    effective_new_customers := target_new_customers;
    effective_total_paying_customers := target_total_paying_customers;
  end if;

  saved_period_id := private.save_monthly_actuals(
    target_business_id,
    target_month_start,
    effective_new_customers,
    effective_total_paying_customers,
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

create or replace function public.set_transaction_history_complete(
  p_business_id uuid,
  p_complete boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_business_id is null or p_complete is null then
    raise exception 'business id and completeness state are required'
      using errcode = '22023';
  end if;

  if (select auth.uid()) is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  if not (select private.can_manage_business(p_business_id)) then
    raise exception 'not allowed to manage transaction history status for this business'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.businesses as business
    where business.id = p_business_id
  ) then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'monthly-customer-counts:' || p_business_id::text,
      0
    )
  );

  insert into public.business_transaction_history_status (
    business_id,
    is_complete,
    confirmed_at,
    confirmed_by_user_id,
    updated_at
  )
  values (
    p_business_id,
    p_complete,
    case when p_complete then now() else null end,
    case when p_complete then (select auth.uid()) else null end,
    now()
  )
  on conflict (business_id)
  do update set
    is_complete = excluded.is_complete,
    confirmed_at = excluded.confirmed_at,
    confirmed_by_user_id = excluded.confirmed_by_user_id,
    updated_at = excluded.updated_at;

  if p_complete then
    perform private.refresh_monthly_customer_counts_for_business(p_business_id);
  end if;

  return true;
end;
$$;

revoke all on function public.set_transaction_history_complete(uuid, boolean) from public;
revoke all on function public.set_transaction_history_complete(uuid, boolean) from anon;
revoke all on function public.set_transaction_history_complete(uuid, boolean) from authenticated;
grant execute on function public.set_transaction_history_complete(uuid, boolean) to authenticated;

comment on table public.business_transaction_history_status is
  'Business-scoped trust state for whether imported transaction history covers the business from its earliest available payment. Incomplete history must never make earliest-known transactions authoritative New Customer evidence. A completed record retains its confirmation timestamp if the confirming auth user is later deleted; the confirmer foreign key is then intentionally null.';

comment on function public.set_transaction_history_complete(uuid, boolean) is
  'Owner/admin-only transition for transaction-history completeness. Marking complete recalculates existing monthly New Customer counts, including authoritative zero-count months, while holding the shared transaction/monthly advisory lock.';
