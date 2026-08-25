create or replace view public.customer_transaction_groups
with (security_invoker = true, security_barrier = true)
as
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
    count(*) filter (
      where transaction.normalized_outcome = 'successful'
    )::bigint as transaction_count,
    count(*) filter (
      where transaction.normalized_outcome = 'successful'
        and transaction.transaction_type = 'collection'
    )::bigint as collection_count,
    count(*) filter (
      where transaction.normalized_outcome = 'successful'
        and transaction.transaction_type = 'refund'
    )::bigint as refund_count,
    coalesce(
      sum(transaction.amount_collected) filter (
        where transaction.normalized_outcome = 'successful'
          and transaction.transaction_type = 'collection'
      ),
      0::numeric
    ) as gross_cash_collected,
    coalesce(
      sum(transaction.amount_collected) filter (
        where transaction.normalized_outcome = 'successful'
          and transaction.transaction_type = 'refund'
      ),
      0::numeric
    ) as refunds,
    coalesce(
      sum(
        case
          when transaction.normalized_outcome = 'successful'
            and transaction.transaction_type = 'collection'
            then transaction.amount_collected
          when transaction.normalized_outcome = 'successful'
            and transaction.transaction_type = 'refund'
            then -transaction.amount_collected
          else 0::numeric
        end
      ),
      0::numeric
    ) as net_cash_collected,
    max(transaction.transaction_at) filter (
      where transaction.normalized_outcome = 'successful'
    ) as last_transaction_at,
    min(transaction.currency) filter (
      where transaction.normalized_outcome = 'successful'
    ) as currency
  from public.customer_transactions as transaction
  group by transaction.business_id, transaction.customer_email
)
select
  grouped.business_id,
  grouped.customer_email,
  grouped.acquisition_at,
  grouped.acquisition_date,
  grouped.transaction_count,
  grouped.collection_count,
  grouped.refund_count,
  grouped.gross_cash_collected,
  grouped.refunds,
  grouped.net_cash_collected,
  pg_catalog.trim_scale(grouped.gross_cash_collected)::text as gross_cash_collected_text,
  pg_catalog.trim_scale(grouped.refunds)::text as refunds_text,
  pg_catalog.trim_scale(grouped.net_cash_collected)::text as net_cash_collected_text,
  grouped.last_transaction_at,
  grouped.currency
from grouped;

revoke all on public.customer_transaction_groups from public;
revoke all on public.customer_transaction_groups from anon;
revoke all on public.customer_transaction_groups from authenticated;
grant select on public.customer_transaction_groups to authenticated;
grant select on public.customer_transaction_groups to service_role;

comment on view public.customer_transaction_groups is
  'Task 21 business-scoped customer identity groups derived from normalized email and successful persisted transaction history. Acquisition is the earliest successful positive collection; refunds never establish acquisition. Numeric totals remain exact for calculations and canonical text columns preserve exact values across JSON transport for display.';
