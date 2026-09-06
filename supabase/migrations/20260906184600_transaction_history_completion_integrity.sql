update public.business_transaction_history_status as status
set
  is_complete = false,
  confirmed_at = null,
  confirmed_by_user_id = null,
  updated_at = now()
where status.is_complete = true
  and not exists (
    select 1
    from public.customer_transactions as transaction
    where transaction.business_id = status.business_id
      and transaction.normalized_outcome = 'successful'
      and transaction.transaction_type = 'collection'
      and transaction.amount_collected > 0
  );

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

  if p_complete and not exists (
    select 1
    from public.customer_transactions as transaction
    where transaction.business_id = p_business_id
      and transaction.normalized_outcome = 'successful'
      and transaction.transaction_type = 'collection'
      and transaction.amount_collected > 0
  ) then
    raise exception 'at least one successful positive customer collection must be saved before transaction history can be marked complete'
      using errcode = 'MZ001';
  end if;

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

comment on function public.set_transaction_history_complete(uuid, boolean) is
  'Owner/admin-only transition for transaction-history completeness. Completion requires at least one saved successful positive collection, then recalculates existing monthly New Customer counts while holding the shared transaction/monthly advisory lock.';
