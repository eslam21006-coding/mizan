alter table public.customer_transactions
add column customer_name text;

alter table public.customer_transactions
add constraint customer_transactions_customer_name_valid
check (
  customer_name is null
  or (
    char_length(customer_name) between 1 and 200
    and customer_name = regexp_replace(customer_name, '^[[:space:]]+|[[:space:]]+$', '', 'g')
  )
)
not valid;

alter table public.customer_transactions
validate constraint customer_transactions_customer_name_valid;

comment on column public.customer_transactions.customer_name is
  'Optional display-only customer name metadata. Customer identity remains normalized customer_email.';

create or replace function public.apply_customer_transaction_names(p_business_id uuid, p_source text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_source text := lower(btrim(coalesce(p_source, '')));
  source_row jsonb;
  import_row_token_value uuid;
  source_transaction_id_value text;
  customer_email_value text;
  customer_name_value text;
  affected_rows integer;
  updated_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to apply customer names.';
  end if;
  if not ((select private.is_admin()) or exists (
    select 1 from public.businesses as business
    where business.id = p_business_id and business.owner_user_id = (select auth.uid())
  )) then
    raise insufficient_privilege using message = 'Only the business owner or an admin can apply customer names.';
  end if;
  if char_length(normalized_source) not between 1 and 80 then
    raise invalid_parameter_value using message = 'Transaction source must be between 1 and 80 characters.';
  end if;
  if not exists (
    select 1 from public.customer_transaction_sources as registered_source
    where registered_source.business_id = p_business_id and registered_source.source = normalized_source
  ) then
    raise invalid_parameter_value using message = 'Select a registered transaction source before applying customer names.';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise invalid_parameter_value using message = 'Customer-name rows must be a JSON array.';
  end if;
  if jsonb_array_length(p_rows) not between 1 and 500 then
    raise invalid_parameter_value using message = 'Each customer-name chunk must contain between 1 and 500 rows.';
  end if;
  for source_row in select value from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(source_row) is distinct from 'object' then
      raise invalid_parameter_value using message = 'Every customer-name row must be a JSON object.';
    end if;
    customer_name_value := nullif(
      regexp_replace(coalesce(source_row ->> 'customer_name', ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'),
      ''
    );
    if customer_name_value is null then continue; end if;
    if char_length(customer_name_value) > 200 then
      raise invalid_parameter_value using message = 'Customer name must be 200 characters or fewer.';
    end if;
    begin
      import_row_token_value := (source_row ->> 'import_row_token')::uuid;
    exception when others then
      raise invalid_parameter_value using message = 'Import row token must be a UUID.';
    end;
    if import_row_token_value is null then
      raise invalid_parameter_value using message = 'Import row token is required.';
    end if;
    customer_email_value := lower(btrim(coalesce(source_row ->> 'customer_email', '')));
    if char_length(customer_email_value) not between 3 and 320 or customer_email_value !~ '^[^[:space:]@]+@[^[:space:]@]+$' then
      raise invalid_parameter_value using message = 'Customer email is invalid.';
    end if;
    source_transaction_id_value := nullif(btrim(coalesce(source_row ->> 'transaction_id', '')), '');
    if source_transaction_id_value is not null and char_length(source_transaction_id_value) > 512 then
      raise invalid_parameter_value using message = 'Transaction ID must be 512 characters or fewer.';
    end if;
    update public.customer_transactions as transaction
    set customer_name = customer_name_value
    where transaction.business_id = p_business_id
      and transaction.import_row_token = import_row_token_value
      and transaction.customer_email = customer_email_value
      and transaction.customer_name is null;
    get diagnostics affected_rows = row_count;
    updated_count := updated_count + affected_rows;
    if affected_rows = 0 and source_transaction_id_value is not null then
      update public.customer_transactions as transaction
      set customer_name = customer_name_value
      where transaction.business_id = p_business_id
        and transaction.source = normalized_source
        and transaction.source_transaction_id = source_transaction_id_value
        and transaction.customer_email = customer_email_value
        and transaction.customer_name is null;
      get diagnostics affected_rows = row_count;
      updated_count := updated_count + affected_rows;
    end if;
  end loop;
  return updated_count;
end;
$$;

revoke all on function public.apply_customer_transaction_names(uuid, text, jsonb) from public;
revoke all on function public.apply_customer_transaction_names(uuid, text, jsonb) from anon;
grant execute on function public.apply_customer_transaction_names(uuid, text, jsonb) to authenticated;
grant execute on function public.apply_customer_transaction_names(uuid, text, jsonb) to service_role;

create or replace view public.customer_transaction_groups
with (security_invoker = true, security_barrier = true) as
with grouped as (
  select
    transaction.business_id,
    transaction.customer_email,
    min(transaction.transaction_at) filter (where transaction.normalized_outcome = 'successful' and transaction.transaction_type = 'collection' and transaction.amount_collected > 0) as acquisition_at,
    min(transaction.transaction_date) filter (where transaction.normalized_outcome = 'successful' and transaction.transaction_type = 'collection' and transaction.amount_collected > 0) as acquisition_date,
    count(*) filter (where transaction.normalized_outcome = 'successful') as transaction_count,
    count(*) filter (where transaction.normalized_outcome = 'successful' and transaction.transaction_type = 'collection') as collection_count,
    count(*) filter (where transaction.normalized_outcome = 'successful' and transaction.transaction_type = 'refund') as refund_count,
    coalesce(sum(transaction.amount_collected) filter (where transaction.normalized_outcome = 'successful' and transaction.transaction_type = 'collection'), 0::numeric) as gross_cash_collected,
    coalesce(sum(transaction.amount_collected) filter (where transaction.normalized_outcome = 'successful' and transaction.transaction_type = 'refund'), 0::numeric) as refunds,
    coalesce(sum(case
      when transaction.normalized_outcome = 'successful' and transaction.transaction_type = 'collection' then transaction.amount_collected
      when transaction.normalized_outcome = 'successful' and transaction.transaction_type = 'refund' then -transaction.amount_collected
      else 0::numeric
    end), 0::numeric) as net_cash_collected,
    max(transaction.transaction_at) filter (where transaction.normalized_outcome = 'successful') as last_transaction_at,
    min(transaction.currency) filter (where transaction.normalized_outcome = 'successful') as currency,
    (array_agg(transaction.customer_name order by transaction.transaction_at desc, transaction.created_at desc, transaction.id desc)
      filter (where transaction.normalized_outcome = 'successful' and transaction.customer_name is not null))[1] as customer_name
  from public.customer_transactions as transaction
  group by transaction.business_id, transaction.customer_email
)
select
  business_id, customer_email, acquisition_at, acquisition_date, transaction_count, collection_count,
  refund_count, gross_cash_collected, refunds, net_cash_collected,
  trim_scale(gross_cash_collected)::text as gross_cash_collected_text,
  trim_scale(refunds)::text as refunds_text,
  trim_scale(net_cash_collected)::text as net_cash_collected_text,
  last_transaction_at, currency, customer_name
from grouped;

revoke all on public.customer_transaction_groups from anon;
grant select on public.customer_transaction_groups to authenticated;
grant select on public.customer_transaction_groups to service_role;
