create or replace view public.customer_history_overview
with (security_invoker = true, security_barrier = true)
as
with aggregated as (
  select
    business.id as business_id,
    count(customer.customer_email) filter (
      where customer.acquisition_at is not null
    )::bigint as paying_customer_count,
    count(customer.customer_email) filter (
      where customer.acquisition_at is not null
        and customer.collection_count > 1
    )::bigint as repeat_customer_count,
    coalesce(sum(customer.gross_cash_collected), 0::numeric) as gross_cash_collected,
    coalesce(sum(customer.refunds), 0::numeric) as refunds,
    coalesce(sum(customer.net_cash_collected), 0::numeric) as net_cash_collected
  from public.businesses as business
  left join public.customer_transaction_groups as customer
    on customer.business_id = business.id
  group by business.id
)
select
  aggregated.business_id,
  aggregated.paying_customer_count,
  aggregated.repeat_customer_count,
  aggregated.gross_cash_collected,
  aggregated.refunds,
  aggregated.net_cash_collected,
  case
    when aggregated.paying_customer_count = 0 then null
    else aggregated.net_cash_collected / aggregated.paying_customer_count::numeric
  end as revenue_per_paying_customer,
  aggregated.paying_customer_count::text as paying_customer_count_text,
  aggregated.repeat_customer_count::text as repeat_customer_count_text,
  pg_catalog.trim_scale(aggregated.gross_cash_collected)::text as gross_cash_collected_text,
  pg_catalog.trim_scale(aggregated.refunds)::text as refunds_text,
  pg_catalog.trim_scale(aggregated.net_cash_collected)::text as net_cash_collected_text,
  case
    when aggregated.paying_customer_count = 0 then null
    else pg_catalog.trim_scale(
      aggregated.net_cash_collected / aggregated.paying_customer_count::numeric
    )::text
  end as revenue_per_paying_customer_text
from aggregated;

revoke all on public.customer_history_overview from public;
revoke all on public.customer_history_overview from anon;
revoke all on public.customer_history_overview from authenticated;
grant select on public.customer_history_overview to authenticated;
grant select on public.customer_history_overview to service_role;

comment on view public.customer_history_overview is
  'Business-scoped customer-history overview derived from Task 21 customer identity groups. Paying customers require a successful positive collection; repeat customers require more than one successful collection. Net Cash includes refunds, including refund-only identities. Revenue per Paying Customer is Net Cash divided by paying customers and is explicitly not LTV. The security-invoker view inherits business and transaction RLS.';
