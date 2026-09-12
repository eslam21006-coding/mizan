create or replace view public.customer_lifetime_contribution_profit_observations
with (security_invoker = true, security_barrier = true)
as
with relevant_activity_months as (
  select distinct
    evidence.business_id,
    evidence.cohort_month,
    evidence.activity_month
  from public.customer_economics_activity_evidence as evidence
),
quality_by_observation as (
  select
    observation.business_id,
    observation.cohort_month,
    observation.observation_month,
    count(*) filter (
      where relevant.activity_month is not null
    )::bigint as relevant_activity_month_count,
    count(*) filter (
      where relevant.activity_month is not null
        and period_quality.activity_month is null
    )::bigint as missing_relevant_period_count,
    count(*) filter (
      where relevant.activity_month is not null
        and period_quality.quality_state = 'incomplete'
    )::bigint as incomplete_relevant_period_count,
    count(*) filter (
      where relevant.activity_month is not null
        and period_quality.quality_state = 'estimated'
    )::bigint as estimated_relevant_period_count
  from public.customer_cohort_observations as observation
  left join relevant_activity_months as relevant
    on relevant.business_id = observation.business_id
   and relevant.cohort_month = observation.cohort_month
   and relevant.activity_month <= observation.observation_month
  left join public.customer_economics_period_quality as period_quality
    on period_quality.business_id = relevant.business_id
   and period_quality.activity_month = relevant.activity_month
  group by
    observation.business_id,
    observation.cohort_month,
    observation.observation_month
),
automatic_costs_by_observation as (
  select
    observation.business_id,
    observation.cohort_month,
    observation.observation_month,
    coalesce(sum(allocation.allocated_amount) filter (
      where allocation.category_snapshot = 'acquisition'
    ), 0::numeric) as acquisition_costs,
    coalesce(sum(allocation.allocated_amount) filter (
      where allocation.category_snapshot = 'fulfillment'
    ), 0::numeric) as variable_fulfillment_costs,
    coalesce(sum(allocation.allocated_amount) filter (
      where allocation.category_snapshot = 'overhead'
    ), 0::numeric) as other_variable_costs,
    coalesce(sum(allocation.allocated_amount) filter (
      where allocation.category_snapshot = 'financial'
    ), 0::numeric) as variable_financial_costs,
    count(allocation.authoritative_source_id)::bigint as automatic_allocation_count
  from public.customer_cohort_observations as observation
  left join public.customer_economics_cost_allocations as allocation
    on allocation.business_id = observation.business_id
   and allocation.cohort_month = observation.cohort_month
   and allocation.activity_month <= observation.observation_month
  group by
    observation.business_id,
    observation.cohort_month,
    observation.observation_month
),
legacy_by_cohort as (
  select
    legacy.business_id,
    legacy.cohort_month,
    count(*)::bigint as legacy_manual_allocation_count
  from public.customer_economics_legacy_manual_allocations as legacy
  group by legacy.business_id, legacy.cohort_month
),
joined as (
  select
    observation.business_id,
    observation.cohort_month,
    observation.observation_month,
    observation.observation_cutoff_date,
    observation.original_cohort_size,
    observation.cumulative_net_cash_collected as lifetime_net_cash,
    observation.cumulative_net_cash_collected_text as lifetime_net_cash_text,
    costs.acquisition_costs,
    costs.variable_fulfillment_costs,
    costs.other_variable_costs,
    costs.variable_financial_costs,
    costs.automatic_allocation_count,
    coalesce(history.is_complete, false) as transaction_history_complete,
    quality.relevant_activity_month_count,
    quality.missing_relevant_period_count,
    quality.incomplete_relevant_period_count,
    quality.estimated_relevant_period_count,
    coalesce(legacy.legacy_manual_allocation_count, 0) as legacy_manual_allocation_count,
    observation.currency,
    observation.is_current_observation,
    case
      when not coalesce(history.is_complete, false) then 'incomplete'
      when coalesce(legacy.legacy_manual_allocation_count, 0) > 0 then 'incomplete'
      when quality.missing_relevant_period_count > 0 then 'incomplete'
      when quality.incomplete_relevant_period_count > 0 then 'incomplete'
      when quality.estimated_relevant_period_count > 0
        or costs.automatic_allocation_count > 0 then 'estimated'
      else 'actual'
    end as quality_state
  from public.customer_cohort_observations as observation
  join quality_by_observation as quality
    on quality.business_id = observation.business_id
   and quality.cohort_month = observation.cohort_month
   and quality.observation_month = observation.observation_month
  join automatic_costs_by_observation as costs
    on costs.business_id = observation.business_id
   and costs.cohort_month = observation.cohort_month
   and costs.observation_month = observation.observation_month
  left join public.business_transaction_history_status as history
    on history.business_id = observation.business_id
  left join legacy_by_cohort as legacy
    on legacy.business_id = observation.business_id
   and legacy.cohort_month = observation.cohort_month
),
metrics as (
  select
    joined.*,
    joined.acquisition_costs
      + joined.variable_fulfillment_costs
      + joined.other_variable_costs
      + joined.variable_financial_costs as lifetime_attributable_costs
  from joined
)
select
  metrics.business_id,
  metrics.cohort_month,
  metrics.observation_month,
  metrics.observation_cutoff_date,
  metrics.original_cohort_size,
  metrics.lifetime_net_cash,
  metrics.lifetime_net_cash_text,
  metrics.acquisition_costs,
  metrics.variable_fulfillment_costs,
  metrics.other_variable_costs,
  metrics.variable_financial_costs as payment_processing_costs,
  metrics.quality_state <> 'incomplete' as allocation_complete,
  false as uses_explicit_allocation,
  case
    when metrics.quality_state <> 'incomplete' then
      metrics.lifetime_net_cash - metrics.lifetime_attributable_costs
    else null
  end as lifetime_contribution_profit,
  case
    when metrics.quality_state <> 'incomplete' then
      (metrics.lifetime_net_cash - metrics.lifetime_attributable_costs)
      / metrics.original_cohort_size::numeric
    else null
  end as lifetime_contribution_profit_per_customer,
  case
    when metrics.quality_state <> 'incomplete' then
      pg_catalog.trim_scale(
        metrics.lifetime_net_cash - metrics.lifetime_attributable_costs
      )::text
    else null
  end as lifetime_contribution_profit_text,
  case
    when metrics.quality_state <> 'incomplete' then
      pg_catalog.trim_scale(
        (metrics.lifetime_net_cash - metrics.lifetime_attributable_costs)
        / metrics.original_cohort_size::numeric
      )::text
    else null
  end as lifetime_contribution_profit_per_customer_text,
  metrics.currency,
  metrics.quality_state,
  metrics.transaction_history_complete,
  metrics.relevant_activity_month_count,
  metrics.missing_relevant_period_count,
  metrics.incomplete_relevant_period_count,
  metrics.estimated_relevant_period_count,
  metrics.legacy_manual_allocation_count,
  metrics.automatic_allocation_count > 0 as uses_automatic_allocation,
  metrics.variable_financial_costs,
  metrics.lifetime_attributable_costs,
  pg_catalog.trim_scale(metrics.variable_financial_costs)::text
    as variable_financial_costs_text,
  pg_catalog.trim_scale(metrics.lifetime_attributable_costs)::text
    as lifetime_attributable_costs_text,
  metrics.is_current_observation
from metrics;

revoke all on public.customer_lifetime_contribution_profit_observations from public;
revoke all on public.customer_lifetime_contribution_profit_observations from anon;
revoke all on public.customer_lifetime_contribution_profit_observations from authenticated;
grant select on public.customer_lifetime_contribution_profit_observations to authenticated;
grant select on public.customer_lifetime_contribution_profit_observations to service_role;

comment on view public.customer_lifetime_contribution_profit_observations is
  'Task 3 automatic Lifetime Contribution Profit by acquisition group and observation month. Lifetime Net Cash uses the exact Observed LTV cutoff. Eligible deterministic Customer Economics allocations are accumulated only through the observation month. Fixed non-acquisition monthly costs remain structurally excluded. Missing relevant monthly financial coverage, incomplete period quality, incomplete transaction history, or any unreconciled legacy manual allocation keeps the metric unavailable. Legacy manual amounts are preserved for audit and are never added to profit.';

create or replace view public.customer_lifetime_contribution_profit
with (security_invoker = true, security_barrier = true)
as
select
  observation.business_id,
  observation.cohort_month,
  observation.observation_month,
  observation.observation_cutoff_date,
  observation.original_cohort_size,
  observation.lifetime_net_cash,
  observation.lifetime_net_cash_text,
  observation.acquisition_costs,
  observation.variable_fulfillment_costs,
  observation.other_variable_costs,
  observation.payment_processing_costs,
  observation.allocation_complete,
  observation.uses_explicit_allocation,
  observation.lifetime_contribution_profit,
  observation.lifetime_contribution_profit_per_customer,
  observation.lifetime_contribution_profit_text,
  observation.lifetime_contribution_profit_per_customer_text,
  observation.currency,
  observation.quality_state,
  observation.transaction_history_complete,
  observation.relevant_activity_month_count,
  observation.missing_relevant_period_count,
  observation.incomplete_relevant_period_count,
  observation.estimated_relevant_period_count,
  observation.legacy_manual_allocation_count,
  observation.uses_automatic_allocation,
  observation.variable_financial_costs,
  observation.lifetime_attributable_costs,
  observation.variable_financial_costs_text,
  observation.lifetime_attributable_costs_text
from public.customer_lifetime_contribution_profit_observations as observation
where observation.is_current_observation;

revoke all on public.customer_lifetime_contribution_profit from public;
revoke all on public.customer_lifetime_contribution_profit from anon;
revoke all on public.customer_lifetime_contribution_profit from authenticated;
grant select on public.customer_lifetime_contribution_profit to authenticated;
grant select on public.customer_lifetime_contribution_profit to service_role;

comment on view public.customer_lifetime_contribution_profit is
  'Task 3 current automatic Lifetime Contribution Profit snapshot by first-purchase customer group. Formula remains Lifetime Net Cash minus eligible acquisition and customer-linked variable costs. The legacy payment_processing_costs column is retained for compatibility and now mirrors eligible variable Financial costs because the current Expense model groups processor fees and taxes under Financial. Use variable_financial_costs for the precise automatic-engine label.';

create or replace view public.customer_lifetime_contribution_profit_display
with (security_invoker = true, security_barrier = true)
as
select
  contribution.business_id,
  contribution.cohort_month,
  contribution.observation_month,
  contribution.observation_cutoff_date,
  contribution.original_cohort_size,
  contribution.lifetime_net_cash,
  contribution.lifetime_net_cash_text,
  contribution.acquisition_costs,
  contribution.variable_fulfillment_costs,
  contribution.other_variable_costs,
  contribution.payment_processing_costs,
  contribution.allocation_complete,
  contribution.uses_explicit_allocation,
  contribution.lifetime_contribution_profit,
  contribution.lifetime_contribution_profit_per_customer,
  contribution.lifetime_contribution_profit_text,
  contribution.lifetime_contribution_profit_per_customer_text,
  contribution.currency,
  pg_catalog.trim_scale(contribution.acquisition_costs)::text as acquisition_costs_text,
  pg_catalog.trim_scale(contribution.variable_fulfillment_costs)::text
    as variable_fulfillment_costs_text,
  pg_catalog.trim_scale(contribution.other_variable_costs)::text as other_variable_costs_text,
  pg_catalog.trim_scale(contribution.payment_processing_costs)::text
    as payment_processing_costs_text,
  pg_catalog.trim_scale(
    contribution.acquisition_costs
    + contribution.variable_fulfillment_costs
    + contribution.other_variable_costs
    + contribution.payment_processing_costs
  )::text as attributable_costs_text,
  contribution.quality_state,
  contribution.transaction_history_complete,
  contribution.relevant_activity_month_count,
  contribution.missing_relevant_period_count,
  contribution.incomplete_relevant_period_count,
  contribution.estimated_relevant_period_count,
  contribution.legacy_manual_allocation_count,
  contribution.uses_automatic_allocation,
  contribution.variable_financial_costs,
  contribution.lifetime_attributable_costs,
  contribution.variable_financial_costs_text,
  contribution.lifetime_attributable_costs_text
from public.customer_lifetime_contribution_profit as contribution;

revoke all on public.customer_lifetime_contribution_profit_display from public;
revoke all on public.customer_lifetime_contribution_profit_display from anon;
revoke all on public.customer_lifetime_contribution_profit_display from authenticated;
grant select on public.customer_lifetime_contribution_profit_display to authenticated;
grant select on public.customer_lifetime_contribution_profit_display to service_role;

comment on view public.customer_lifetime_contribution_profit_display is
  'Task 3 exact-text current Lifetime Contribution Profit display surface. Existing Task 25 columns are preserved and Task 3 automatic-engine quality/provenance fields are appended.';
