do $$
begin
  if exists (
    select 1
    from public.customer_transactions as transaction
    join public.businesses as business
      on business.id = transaction.business_id
    where transaction.currency <> business.base_currency
  ) then
    raise exception 'Existing customer transaction currency does not match the business base currency. Reconcile transaction history before enabling cohort economics.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.customer_transactions as transaction
    join public.businesses as business
      on business.id = transaction.business_id
    where transaction.transaction_date <>
      (transaction.transaction_at at time zone business.timezone)::date
  ) then
    raise exception 'Existing customer transaction reporting dates do not match the business timezone. Reconcile transaction history before enabling cohort economics.'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.enforce_customer_transaction_reporting_basis()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  business_currency text;
  business_timezone text;
begin
  select business.base_currency, business.timezone
  into business_currency, business_timezone
  from public.businesses as business
  where business.id = new.business_id;

  if not found then
    raise exception 'Customer transaction business does not exist.'
      using errcode = '23503';
  end if;

  if new.currency <> business_currency then
    raise exception 'Customer transaction currency must equal the business base currency.'
      using errcode = '23514';
  end if;

  if new.transaction_date <>
    (new.transaction_at at time zone business_timezone)::date then
    raise exception 'Customer transaction reporting date must match transaction_at in the business timezone.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_customer_transaction_reporting_basis() from public;
revoke all on function private.enforce_customer_transaction_reporting_basis() from anon;
revoke all on function private.enforce_customer_transaction_reporting_basis() from authenticated;

create trigger enforce_customer_transaction_reporting_basis
  before insert or update of business_id, currency, transaction_at, transaction_date
  on public.customer_transactions
  for each row execute function private.enforce_customer_transaction_reporting_basis();

create or replace function private.prevent_business_transaction_basis_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    old.base_currency is distinct from new.base_currency
    or old.timezone is distinct from new.timezone
  ) and exists (
    select 1
    from public.customer_transactions as transaction
    where transaction.business_id = old.id
  ) then
    raise exception 'Business base currency and reporting timezone cannot change after customer transaction history exists. Use an explicit reviewed history migration instead.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_business_transaction_basis_update() from public;
revoke all on function private.prevent_business_transaction_basis_update() from anon;
revoke all on function private.prevent_business_transaction_basis_update() from authenticated;

create trigger prevent_business_transaction_basis_update
  before update of base_currency, timezone on public.businesses
  for each row execute function private.prevent_business_transaction_basis_update();
