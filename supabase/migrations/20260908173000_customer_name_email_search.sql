create or replace view public.customer_transaction_groups
with (security_invoker = true, security_barrier = true) as
with grouped as (
  select
    transaction.business_id,
    transaction.customer_email,
    min(transaction.transaction_at) filter (
      where transaction.normalized_outcome = 'successful'
        and transaction.transaction_type = 'collection'
        and transaction.amount_collected > 0
    ) as acquisition_at,
    min(transaction.transaction_date) filter (
      where transaction.normalized_outcome = 'successful'
        and transaction.transaction_type = 'collection'
        and transaction.amount_collected > 0
    ) as acquisition_date,
    count(*) filter (where transaction.normalized_outcome = 'successful') as transaction_count,
    count(*) filter (
      where transaction.normalized_outcome = 'successful'
        and transaction.transaction_type = 'collection'
    ) as collection_count,
    count(*) filter (
      where transaction.normalized_outcome = 'successful'
        and transaction.transaction_type = 'refund'
    ) as refund_count,
    coalesce(sum(transaction.amount_collected) filter (
      where transaction.normalized_outcome = 'successful'
        and transaction.transaction_type = 'collection'
    ), 0::numeric) as gross_cash_collected,
    coalesce(sum(transaction.amount_collected) filter (
      where transaction.normalized_outcome = 'successful'
        and transaction.transaction_type = 'refund'
    ), 0::numeric) as refunds,
    coalesce(sum(case
      when transaction.normalized_outcome = 'successful'
        and transaction.transaction_type = 'collection' then transaction.amount_collected
      when transaction.normalized_outcome = 'successful'
        and transaction.transaction_type = 'refund' then -transaction.amount_collected
      else 0::numeric
    end), 0::numeric) as net_cash_collected,
    max(transaction.transaction_at) filter (
      where transaction.normalized_outcome = 'successful'
    ) as last_transaction_at,
    min(transaction.currency) filter (
      where transaction.normalized_outcome = 'successful'
    ) as currency,
    (array_agg(
      transaction.customer_name
      order by transaction.transaction_at desc, transaction.created_at desc, transaction.id desc
    ) filter (
      where transaction.normalized_outcome = 'successful'
        and transaction.customer_name is not null
    ))[1] as customer_name
  from public.customer_transactions as transaction
  group by transaction.business_id, transaction.customer_email
)
select
  business_id,
  customer_email,
  acquisition_at,
  acquisition_date,
  transaction_count,
  collection_count,
  refund_count,
  gross_cash_collected,
  refunds,
  net_cash_collected,
  trim_scale(gross_cash_collected)::text as gross_cash_collected_text,
  trim_scale(refunds)::text as refunds_text,
  trim_scale(net_cash_collected)::text as net_cash_collected_text,
  last_transaction_at,
  currency,
  customer_name,
  concat_ws(' ', customer_name, customer_email) as customer_search_text
from grouped;

comment on column public.customer_transaction_groups.customer_search_text is
  'Display-only search projection over optional customer name plus normalized customer email. It is not a customer identity key.';

revoke all on public.customer_transaction_groups from anon;
grant select on public.customer_transaction_groups to authenticated;
grant select on public.customer_transaction_groups to service_role;
