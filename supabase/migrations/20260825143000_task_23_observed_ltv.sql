create or replace view public.customer_cohort_observations
with (security_invoker = true, security_barrier = true)
as
with cohort_context as (
  select
    cohort.business_id,
    cohort.cohort_month,
    cohort.currency,
    count(*)::bigint as original_cohort_size,
    business.timezone,
    (current_timestamp at time zone business.timezone)::date as current_local_date,
    pg_catalog.date_trunc(
      'month',
      current_timestamp at time zone business.timezone
    )::date as current_observation_month
  from public.customer_acquisition_cohorts as cohort
  join public.businesses as business
    on business.id = cohort.business_id
  group by
    cohort.business_id,
    cohort.cohort_month,
    cohort.currency,
    business.timezone
),
observation_calendar as (
  select
    context.business_id,
    context.cohort_month,
    context.currency,
    context.original_cohort_size,
    context.current_observation_month,
    generated.observation_month::date as observation_month,
    least(
      (generated.observation_month + interval '1 month - 1 day')::date,
      context.current_local_date
    ) as observation_cutoff_date
  from cohort_context as context
  cross join lateral pg_catalog.generate_series(
    context.cohort_month::timestamp,
    context.current_observation_month::timestamp,
    interval '1 month'
  ) as generated(observation_month)
),
aggregated as (
  select
    calendar.business_id,
    calendar.cohort_month,
    calendar.observation_month,
    calendar.observation_cutoff_date,
    calendar.current_observation_month,
    calendar.original_cohort_size,
    calendar.currency,
    coalesce(
      sum(transaction.amount_collected) filter (
        where transaction.transaction_type = 'collection'
      ),
      0::numeric
    ) as cumulative_gross_cash_collected,
    coalesce(
      sum(transaction.amount_collected) filter (
        where transaction.transaction_type = 'refund'
      ),
      0::numeric
    ) as cumulative_refunds
  from observation_calendar as calendar
  join public.customer_acquisition_cohorts as cohort_member
    on cohort_member.business_id = calendar.business_id
   and cohort_member.cohort_month = calendar.cohort_month
  left join public.customer_transactions as transaction
    on transaction.business_id = cohort_member.business_id
   and transaction.customer_email = cohort_member.customer_email
   and transaction.normalized_outcome = 'successful'
   and transaction.transaction_date <= calendar.observation_cutoff_date
  group by
    calendar.business_id,
    calendar.cohort_month,
    calendar.observation_month,
    calendar.observation_cutoff_date,
    calendar.current_observation_month,
    calendar.original_cohort_size,
    calendar.currency
),
metrics as (
  select
    aggregated.*,
    aggregated.cumulative_gross_cash_collected - aggregated.cumulative_refunds
      as cumulative_net_cash_collected,
    (
      (extract(year from aggregated.observation_month)::integer
        - extract(year from aggregated.cohort_month)::integer) * 12
      + extract(month from aggregated.observation_month)::integer
      - extract(month from aggregated.cohort_month)::integer
    )::integer as cohort_age_months
  from aggregated
)
select
  metrics.business_id,
  metrics.cohort_month,
  metrics.observation_month,
  metrics.observation_cutoff_date,
  metrics.original_cohort_size,
  metrics.cumulative_gross_cash_collected,
  metrics.cumulative_refunds,
  metrics.cumulative_net_cash_collected,
  metrics.cumulative_net_cash_collected / metrics.original_cohort_size::numeric as observed_ltv,
  pg_catalog.trim_scale(metrics.cumulative_gross_cash_collected)::text
    as cumulative_gross_cash_collected_text,
  pg_catalog.trim_scale(metrics.cumulative_refunds)::text as cumulative_refunds_text,
  pg_catalog.trim_scale(metrics.cumulative_net_cash_collected)::text
    as cumulative_net_cash_collected_text,
  pg_catalog.trim_scale(
    metrics.cumulative_net_cash_collected / metrics.original_cohort_size::numeric
  )::text as observed_ltv_text,
  metrics.cohort_age_months,
  metrics.cohort_age_months + 1 as months_observed,
  metrics.observation_month = metrics.current_observation_month as is_current_observation,
  metrics.currency
from metrics;

revoke all on public.customer_cohort_observations from public;
revoke all on public.customer_cohort_observations from anon;
revoke all on public.customer_cohort_observations from authenticated;
grant select on public.customer_cohort_observations to authenticated;
grant select on public.customer_cohort_observations to service_role;

comment on view public.customer_cohort_observations is
  'Task 23 monthly Observed LTV observations. Observed LTV equals cumulative cohort Net Cash divided by the fixed original cohort size. Acquisition month is M0; cohort age is calendar-month difference and months observed equals age plus one. Current-month observations are partial through the business-local current date.';

create or replace view public.customer_observed_ltv
with (security_invoker = true, security_barrier = true)
as
select
  observation.business_id,
  observation.cohort_month,
  observation.observation_month,
  observation.observation_cutoff_date,
  observation.original_cohort_size,
  observation.cumulative_gross_cash_collected,
  observation.cumulative_refunds,
  observation.cumulative_net_cash_collected,
  observation.observed_ltv,
  observation.cumulative_gross_cash_collected_text,
  observation.cumulative_refunds_text,
  observation.cumulative_net_cash_collected_text,
  observation.observed_ltv_text,
  observation.cohort_age_months,
  observation.months_observed,
  observation.currency
from public.customer_cohort_observations as observation
where observation.is_current_observation;

revoke all on public.customer_observed_ltv from public;
revoke all on public.customer_observed_ltv from anon;
revoke all on public.customer_observed_ltv from authenticated;
grant select on public.customer_observed_ltv to authenticated;
grant select on public.customer_observed_ltv to service_role;

comment on view public.customer_observed_ltv is
  'Task 23 current business-local Observed LTV snapshot by acquisition cohort. Values are realized to date, not predicted lifetime value. Exact canonical text columns are provided for browser display without JavaScript floating-point conversion.';
