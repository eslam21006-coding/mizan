create table public.customer_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  source text not null check (
    char_length(source) between 1 and 80
    and source = btrim(source)
    and source = lower(source)
  ),
  source_transaction_id text check (
    source_transaction_id is null
    or (
      char_length(source_transaction_id) between 1 and 512
      and source_transaction_id = btrim(source_transaction_id)
    )
  ),
  customer_email text not null check (
    char_length(customer_email) between 3 and 320
    and customer_email = btrim(customer_email)
    and customer_email = lower(customer_email)
    and customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
  ),
  transaction_date date not null,
  amount_collected numeric not null,
  source_row_number integer not null check (source_row_number > 0),
  imported_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index customer_transactions_source_id_unique_idx
  on public.customer_transactions (business_id, source, source_transaction_id)
  where source_transaction_id is not null;

create unique index customer_transactions_fallback_unique_idx
  on public.customer_transactions (
    business_id,
    source,
    customer_email,
    transaction_date,
    amount_collected
  )
  where source_transaction_id is null;

create index customer_transactions_business_date_idx
  on public.customer_transactions (business_id, transaction_date, id);

alter table public.customer_transactions enable row level security;

revoke all on public.customer_transactions from anon;
revoke all on public.customer_transactions from authenticated;
grant select on public.customer_transactions to authenticated;
grant all on public.customer_transactions to service_role;

create policy customer_transactions_select
on public.customer_transactions for select
to authenticated
using (
  (select private.is_admin())
  or business_id in (
    select membership.business_id
    from public.business_memberships as membership
    where membership.user_id = (select auth.uid())
  )
);

create or replace function public.import_customer_transactions(
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
  normalized_source text := lower(btrim(coalesce(p_source, '')));
  source_row jsonb;
  source_transaction_id_value text;
  customer_email_value text;
  transaction_date_text text;
  transaction_date_value date;
  amount_text text;
  amount_value numeric;
  row_number_value integer;
  affected_rows integer;
  inserted_count integer := 0;
  duplicate_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to import customer transactions.';
  end if;

  if not (
    (select private.is_admin())
    or exists (
      select 1
      from public.businesses as business
      where business.id = p_business_id
        and business.owner_user_id = (select auth.uid())
    )
  ) then
    raise insufficient_privilege using message = 'Only the business owner or an admin can import customer transactions.';
  end if;

  if char_length(normalized_source) not between 1 and 80 then
    raise invalid_parameter_value using message = 'Transaction source must be between 1 and 80 characters.';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise invalid_parameter_value using message = 'Transaction import rows must be a JSON array.';
  end if;

  if jsonb_array_length(p_rows) not between 1 and 500 then
    raise invalid_parameter_value using message = 'Each transaction import chunk must contain between 1 and 500 rows.';
  end if;

  for source_row in
    select value
    from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(source_row) is distinct from 'object' then
      raise invalid_parameter_value using message = 'Every transaction import row must be a JSON object.';
    end if;

    begin
      row_number_value := (source_row ->> 'row_number')::integer;
    exception when others then
      raise invalid_parameter_value using message = 'Transaction source row number must be a positive integer.';
    end;
    if row_number_value <= 0 then
      raise invalid_parameter_value using message = 'Transaction source row number must be a positive integer.';
    end if;

    source_transaction_id_value := nullif(btrim(coalesce(source_row ->> 'transaction_id', '')), '');
    if source_transaction_id_value is not null
      and char_length(source_transaction_id_value) > 512 then
      raise invalid_parameter_value using message = 'Transaction ID must be 512 characters or fewer.';
    end if;

    customer_email_value := lower(btrim(coalesce(source_row ->> 'customer_email', '')));
    if char_length(customer_email_value) not between 3 and 320
      or customer_email_value !~ '^[^[:space:]@]+@[^[:space:]@]+$'
      or customer_email_value <> lower(customer_email_value) then
      raise invalid_parameter_value using message = 'Customer email is invalid.';
    end if;

    transaction_date_text := btrim(coalesce(source_row ->> 'transaction_date', ''));
    if transaction_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise invalid_parameter_value using message = 'Transaction date must use YYYY-MM-DD.';
    end if;
    begin
      transaction_date_value := transaction_date_text::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise invalid_parameter_value using message = 'Transaction date is not a real calendar date.';
    end;
    if to_char(transaction_date_value, 'YYYY-MM-DD') <> transaction_date_text then
      raise invalid_parameter_value using message = 'Transaction date is not a canonical YYYY-MM-DD date.';
    end if;

    amount_text := btrim(coalesce(source_row ->> 'amount_collected', ''));
    if amount_text !~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$' then
      raise invalid_parameter_value using message = 'Amount collected is invalid.';
    end if;
    begin
      amount_value := amount_text::numeric;
    exception when others then
      raise invalid_parameter_value using message = 'Amount collected is outside the supported numeric range.';
    end;

    insert into public.customer_transactions (
      business_id,
      source,
      source_transaction_id,
      customer_email,
      transaction_date,
      amount_collected,
      source_row_number,
      imported_by_user_id
    )
    values (
      p_business_id,
      normalized_source,
      source_transaction_id_value,
      customer_email_value,
      transaction_date_value,
      amount_value,
      row_number_value,
      (select auth.uid())
    )
    on conflict do nothing;

    get diagnostics affected_rows = row_count;
    if affected_rows = 1 then
      inserted_count := inserted_count + 1;
    else
      duplicate_count := duplicate_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'inserted_count', inserted_count,
    'duplicate_count', duplicate_count
  );
end;
$$;

revoke all on function public.import_customer_transactions(uuid, text, jsonb) from public;
revoke all on function public.import_customer_transactions(uuid, text, jsonb) from anon;
revoke all on function public.import_customer_transactions(uuid, text, jsonb) from authenticated;
grant execute on function public.import_customer_transactions(uuid, text, jsonb) to authenticated;
grant execute on function public.import_customer_transactions(uuid, text, jsonb) to service_role;
