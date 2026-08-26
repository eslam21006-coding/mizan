create or replace view public.customer_transaction_revenue_stream_attribution
with (security_invoker = true, security_barrier = true)
as
select
  transaction.id,
  transaction.business_id,
  transaction.customer_email,
  transaction.transaction_at,
  transaction.transaction_date,
  transaction.transaction_type,
  transaction.amount_collected,
  pg_catalog.trim_scale(transaction.amount_collected)::text as amount_collected_text,
  transaction.currency,
  transaction.source,
  transaction.source_transaction_id,
  transaction.revenue_stream_id,
  transaction.revenue_stream_name_snapshot,
  transaction.revenue_stream_type_snapshot
from public.customer_transactions as transaction
where transaction.normalized_outcome = 'successful';

revoke all on public.customer_transaction_revenue_stream_attribution from public;
revoke all on public.customer_transaction_revenue_stream_attribution from anon;
revoke all on public.customer_transaction_revenue_stream_attribution from authenticated;
grant select on public.customer_transaction_revenue_stream_attribution to authenticated;
grant select on public.customer_transaction_revenue_stream_attribution to service_role;

comment on view public.customer_transaction_revenue_stream_attribution is
  'Task 24 auditable transaction attribution surface with exact amount text. RLS is inherited from customer_transactions through security_invoker.';
