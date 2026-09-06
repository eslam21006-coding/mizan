create or replace function private.lock_customer_transaction_monthly_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'monthly-customer-counts:' || new.business_id::text,
      0
    )
  );
  return new;
end;
$$;

revoke all on function private.lock_customer_transaction_monthly_counts() from public;
revoke all on function private.lock_customer_transaction_monthly_counts() from anon;
revoke all on function private.lock_customer_transaction_monthly_counts() from authenticated;

drop trigger if exists lock_customer_transaction_monthly_counts on public.customer_transactions;
create trigger lock_customer_transaction_monthly_counts
  before insert on public.customer_transactions
  for each row execute function private.lock_customer_transaction_monthly_counts();

create or replace function private.refresh_monthly_customer_counts_for_business(
  target_business_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
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
  )
  update public.monthly_periods as period
  set
    new_customers = counts.new_customers,
    total_paying_customers = counts.total_paying_customers
  from monthly_counts as counts
  where period.business_id = target_business_id
    and period.month_start = counts.month_start;
end;
$$;

revoke all on function private.refresh_monthly_customer_counts_for_business(uuid) from public;
revoke all on function private.refresh_monthly_customer_counts_for_business(uuid) from anon;
revoke all on function private.refresh_monthly_customer_counts_for_business(uuid) from authenticated;
revoke all on function private.refresh_monthly_customer_counts_for_business(uuid) from service_role;

alter function public.import_customer_transactions(uuid, text, jsonb)
  set schema private;

revoke all on function private.import_customer_transactions(uuid, text, jsonb) from public;
revoke all on function private.import_customer_transactions(uuid, text, jsonb) from anon;
revoke all on function private.import_customer_transactions(uuid, text, jsonb) from authenticated;
revoke all on function private.import_customer_transactions(uuid, text, jsonb) from service_role;

create function public.import_customer_transactions(
  p_business_id uuid,
  p_source text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_result jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'monthly-customer-counts:' || p_business_id::text,
      0
    )
  );

  import_result := private.import_customer_transactions(
    p_business_id,
    p_source,
    p_rows
  );

  perform private.refresh_monthly_customer_counts_for_business(p_business_id);

  return import_result;
end;
$$;

revoke all on function public.import_customer_transactions(uuid, text, jsonb) from public;
revoke all on function public.import_customer_transactions(uuid, text, jsonb) from anon;
revoke all on function public.import_customer_transactions(uuid, text, jsonb) from authenticated;
revoke all on function public.import_customer_transactions(uuid, text, jsonb) from service_role;
grant execute on function public.import_customer_transactions(uuid, text, jsonb) to authenticated;
grant execute on function public.import_customer_transactions(uuid, text, jsonb) to service_role;

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
  into effective_total_paying_customers, derived_new_customers
  from month_payers as payer
  join first_collection as acquired using (customer_email);

  derived_total_paying_customers := effective_total_paying_customers;

  if derived_total_paying_customers > 0 then
    effective_new_customers := derived_new_customers;
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
