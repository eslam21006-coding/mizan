alter table public.customer_transactions
  add column revenue_stream_id uuid,
  add column revenue_stream_name_snapshot text,
  add column revenue_stream_type_snapshot text;

alter table public.customer_transactions
  add constraint customer_transactions_revenue_stream_business_fk
    foreign key (business_id, revenue_stream_id)
    references public.revenue_streams (business_id, id)
    on delete restrict
    not valid,
  add constraint customer_transactions_revenue_stream_snapshot_check
    check (
      (
        revenue_stream_id is null
        and revenue_stream_name_snapshot is null
        and revenue_stream_type_snapshot is null
      )
      or (
        revenue_stream_id is not null
        and revenue_stream_name_snapshot is not null
        and char_length(btrim(revenue_stream_name_snapshot)) between 1 and 120
        and revenue_stream_type_snapshot in ('front_end', 'backend', 'other')
      )
    )
    not valid;

create index customer_transactions_business_revenue_stream_time_idx
  on public.customer_transactions (business_id, revenue_stream_id, transaction_at, id);

create or replace function public.assign_customer_transaction_revenue_stream(
  p_business_id uuid,
  p_transaction_id uuid,
  p_revenue_stream_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  stream_name text;
  stream_type_value text;
  affected_rows integer;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to attribute a transaction.';
  end if;

  if not (select private.can_manage_business(p_business_id)) then
    raise insufficient_privilege using message = 'Only the business owner or an admin can attribute customer transactions.';
  end if;

  if p_transaction_id is null then
    raise invalid_parameter_value using message = 'Transaction ID is required.';
  end if;

  if p_revenue_stream_id is not null then
    select stream.name, stream.stream_type
    into stream_name, stream_type_value
    from public.revenue_streams as stream
    where stream.business_id = p_business_id
      and stream.id = p_revenue_stream_id;

    if not found then
      raise invalid_parameter_value using message = 'Revenue stream does not belong to this business.';
    end if;
  end if;

  update public.customer_transactions as transaction
  set
    revenue_stream_id = p_revenue_stream_id,
    revenue_stream_name_snapshot = case when p_revenue_stream_id is null then null else stream_name end,
    revenue_stream_type_snapshot = case when p_revenue_stream_id is null then null else stream_type_value end
  where transaction.business_id = p_business_id
    and transaction.id = p_transaction_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise invalid_parameter_value using message = 'Transaction does not belong to this business.';
  end if;

  return p_transaction_id;
end;
$$;

revoke all on function public.assign_customer_transaction_revenue_stream(uuid, uuid, uuid) from public;
revoke all on function public.assign_customer_transaction_revenue_stream(uuid, uuid, uuid) from anon;
revoke all on function public.assign_customer_transaction_revenue_stream(uuid, uuid, uuid) from authenticated;
grant execute on function public.assign_customer_transaction_revenue_stream(uuid, uuid, uuid) to authenticated;
grant execute on function public.assign_customer_transaction_revenue_stream(uuid, uuid, uuid) to service_role;

create or replace view public.customer_cohort_revenue_stream_analysis
with (security_invoker = true, security_barrier = true)
as
with eligible_transactions as (
  select
    cohort.business_id,
    cohort.cohort_month,
    cohort.customer_email,
    transaction.id,
    transaction.revenue_stream_id,
    transaction.revenue_stream_name_snapshot as revenue_stream_name,
    transaction.revenue_stream_type_snapshot as revenue_stream_type,
    transaction.transaction_type,
    transaction.amount_collected,
    transaction.currency
  from public.customer_acquisition_cohorts as cohort
  join public.businesses as business
    on business.id = cohort.business_id
  join public.customer_transactions as transaction
    on transaction.business_id = cohort.business_id
   and transaction.customer_email = cohort.customer_email
  where transaction.normalized_outcome = 'successful'
    and (transaction.transaction_at at time zone business.timezone)::date
      <= (current_timestamp at time zone business.timezone)::date
), aggregated as (
  select
    eligible.business_id,
    eligible.cohort_month,
    eligible.revenue_stream_id,
    eligible.revenue_stream_name,
    eligible.revenue_stream_type,
    count(*)::bigint as transaction_count,
    count(distinct eligible.customer_email)::bigint as customers_with_activity,
    coalesce(
      sum(eligible.amount_collected) filter (
        where eligible.transaction_type = 'collection'
      ),
      0::numeric
    ) as gross_cash_collected,
    coalesce(
      sum(eligible.amount_collected) filter (
        where eligible.transaction_type = 'refund'
      ),
      0::numeric
    ) as refunds,
    min(eligible.currency) as currency
  from eligible_transactions as eligible
  group by
    eligible.business_id,
    eligible.cohort_month,
    eligible.revenue_stream_id,
    eligible.revenue_stream_name,
    eligible.revenue_stream_type
)
select
  aggregated.business_id,
  aggregated.cohort_month,
  aggregated.revenue_stream_id,
  aggregated.revenue_stream_name,
  aggregated.revenue_stream_type,
  aggregated.revenue_stream_id is null as is_unattributed,
  aggregated.transaction_count,
  aggregated.customers_with_activity,
  aggregated.gross_cash_collected,
  aggregated.refunds,
  aggregated.gross_cash_collected - aggregated.refunds as net_cash_collected,
  pg_catalog.trim_scale(aggregated.gross_cash_collected)::text as gross_cash_collected_text,
  pg_catalog.trim_scale(aggregated.refunds)::text as refunds_text,
  pg_catalog.trim_scale(aggregated.gross_cash_collected - aggregated.refunds)::text as net_cash_collected_text,
  aggregated.currency
from aggregated;

revoke all on public.customer_cohort_revenue_stream_analysis from public;
revoke all on public.customer_cohort_revenue_stream_analysis from anon;
revoke all on public.customer_cohort_revenue_stream_analysis from authenticated;
grant select on public.customer_cohort_revenue_stream_analysis to authenticated;
grant select on public.customer_cohort_revenue_stream_analysis to service_role;

create or replace view public.customer_lifetime_revenue_stream_analysis
with (security_invoker = true, security_barrier = true)
as
select
  analysis.business_id,
  analysis.revenue_stream_id,
  analysis.revenue_stream_name,
  analysis.revenue_stream_type,
  analysis.is_unattributed,
  count(*)::bigint as cohort_count,
  sum(analysis.transaction_count)::bigint as transaction_count,
  sum(analysis.customers_with_activity)::bigint as customers_with_activity,
  sum(analysis.gross_cash_collected) as gross_cash_collected,
  sum(analysis.refunds) as refunds,
  sum(analysis.net_cash_collected) as net_cash_collected,
  pg_catalog.trim_scale(sum(analysis.gross_cash_collected))::text as gross_cash_collected_text,
  pg_catalog.trim_scale(sum(analysis.refunds))::text as refunds_text,
  pg_catalog.trim_scale(sum(analysis.net_cash_collected))::text as net_cash_collected_text,
  min(analysis.currency) as currency
from public.customer_cohort_revenue_stream_analysis as analysis
group by
  analysis.business_id,
  analysis.revenue_stream_id,
  analysis.revenue_stream_name,
  analysis.revenue_stream_type,
  analysis.is_unattributed;

revoke all on public.customer_lifetime_revenue_stream_analysis from public;
revoke all on public.customer_lifetime_revenue_stream_analysis from anon;
revoke all on public.customer_lifetime_revenue_stream_analysis from authenticated;
grant select on public.customer_lifetime_revenue_stream_analysis to authenticated;
grant select on public.customer_lifetime_revenue_stream_analysis to service_role;

comment on view public.customer_cohort_revenue_stream_analysis is
  'Task 24 cohort-level lifetime realized cash grouped by explicitly attributed revenue-stream snapshots. Unattributed transactions remain visible as a separate group; Mizan never infers stream attribution from source, amount, or timing.';

comment on view public.customer_lifetime_revenue_stream_analysis is
  'Task 24 business-level lifetime realized customer cash grouped by persisted revenue-stream attribution snapshots across acquisition cohorts. Refunds are contra-revenue and unattributed cash remains explicit.';
