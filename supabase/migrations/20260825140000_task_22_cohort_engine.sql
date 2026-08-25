create or replace view public.customer_acquisition_cohorts
with (security_invoker = true, security_barrier = true)
as
select
  customer_group.business_id,
  customer_group.customer_email,
  customer_group.acquisition_at,
  customer_group.acquisition_date,
  pg_catalog.date_trunc('month', customer_group.acquisition_date::timestamp)::date as cohort_month,
  customer_group.currency
from public.customer_transaction_groups as customer_group
where customer_group.acquisition_date is not null;

revoke all on public.customer_acquisition_cohorts from public;
revoke all on public.customer_acquisition_cohorts from anon;
revoke all on public.customer_acquisition_cohorts from authenticated;
grant select on public.customer_acquisition_cohorts to authenticated;
grant select on public.customer_acquisition_cohorts to service_role;

comment on view public.customer_acquisition_cohorts is
  'Task 22 business-scoped acquisition cohort membership. Each acquired customer belongs to the calendar month containing the earliest successful positive collection date. Refund-only identities are excluded because they have no acquisition date.';

create or replace view public.customer_cohort_monthly_activity
with (security_invoker = true, security_barrier = true)
as
with cohort_sizes as (
  select
    cohort.business_id,
    cohort.cohort_month,
    cohort.currency,
    count(*)::bigint as original_cohort_size
  from public.customer_acquisition_cohorts as cohort
  group by cohort.business_id, cohort.cohort_month, cohort.currency
),
activity as (
  select
    cohort.business_id,
    cohort.cohort_month,
    pg_catalog.date_trunc('month', transaction.transaction_date::timestamp)::date as activity_month,
    count(*)::bigint as transaction_count,
    count(*) filter (
      where transaction.transaction_type = 'collection'
    )::bigint as collection_count,
    count(*) filter (
      where transaction.transaction_type = 'refund'
    )::bigint as refund_count,
    coalesce(
      sum(transaction.amount_collected) filter (
        where transaction.transaction_type = 'collection'
      ),
      0::numeric
    ) as gross_cash_collected,
    coalesce(
      sum(transaction.amount_collected) filter (
        where transaction.transaction_type = 'refund'
      ),
      0::numeric
    ) as refunds
  from public.customer_acquisition_cohorts as cohort
  join public.customer_transactions as transaction
    on transaction.business_id = cohort.business_id
   and transaction.customer_email = cohort.customer_email
  where transaction.normalized_outcome = 'successful'
  group by
    cohort.business_id,
    cohort.cohort_month,
    pg_catalog.date_trunc('month', transaction.transaction_date::timestamp)::date
)
select
  activity.business_id,
  activity.cohort_month,
  activity.activity_month,
  cohort_sizes.original_cohort_size,
  activity.transaction_count,
  activity.collection_count,
  activity.refund_count,
  activity.gross_cash_collected,
  activity.refunds,
  activity.gross_cash_collected - activity.refunds as net_cash_collected,
  pg_catalog.trim_scale(activity.gross_cash_collected)::text as gross_cash_collected_text,
  pg_catalog.trim_scale(activity.refunds)::text as refunds_text,
  pg_catalog.trim_scale(activity.gross_cash_collected - activity.refunds)::text as net_cash_collected_text,
  cohort_sizes.currency
from activity
join cohort_sizes
  on cohort_sizes.business_id = activity.business_id
 and cohort_sizes.cohort_month = activity.cohort_month;

revoke all on public.customer_cohort_monthly_activity from public;
revoke all on public.customer_cohort_monthly_activity from anon;
revoke all on public.customer_cohort_monthly_activity from authenticated;
grant select on public.customer_cohort_monthly_activity to authenticated;
grant select on public.customer_cohort_monthly_activity to service_role;

comment on view public.customer_cohort_monthly_activity is
  'Task 22 monthly transaction activity for each acquisition cohort. Original cohort size is fixed by unique acquired customer membership and does not shrink because of refunds, inactivity, or churn. Financial values use PostgreSQL numeric arithmetic and exact canonical text transport columns.';
