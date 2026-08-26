create or replace view public.customer_cohort_cost_allocation_display
with (security_invoker = true, security_barrier = true)
as
select
  allocation.id,
  allocation.business_id,
  allocation.cohort_month,
  allocation.cost_type,
  allocation.amount,
  pg_catalog.trim_scale(allocation.amount)::text as amount_text,
  allocation.attribution_method,
  allocation.note,
  allocation.created_at,
  allocation.updated_at
from public.customer_cohort_cost_allocations as allocation;

revoke all on public.customer_cohort_cost_allocation_display from public;
revoke all on public.customer_cohort_cost_allocation_display from anon;
revoke all on public.customer_cohort_cost_allocation_display from authenticated;
grant select on public.customer_cohort_cost_allocation_display to authenticated;
grant select on public.customer_cohort_cost_allocation_display to service_role;

create or replace view public.customer_lifetime_contribution_profit_display
with (security_invoker = true, security_barrier = true)
as
select
  contribution.*,
  pg_catalog.trim_scale(contribution.acquisition_costs)::text as acquisition_costs_text,
  pg_catalog.trim_scale(contribution.variable_fulfillment_costs)::text as variable_fulfillment_costs_text,
  pg_catalog.trim_scale(contribution.other_variable_costs)::text as other_variable_costs_text,
  pg_catalog.trim_scale(contribution.payment_processing_costs)::text as payment_processing_costs_text,
  pg_catalog.trim_scale(
    contribution.acquisition_costs
    + contribution.variable_fulfillment_costs
    + contribution.other_variable_costs
    + contribution.payment_processing_costs
  )::text as attributable_costs_text
from public.customer_lifetime_contribution_profit as contribution;

revoke all on public.customer_lifetime_contribution_profit_display from public;
revoke all on public.customer_lifetime_contribution_profit_display from anon;
revoke all on public.customer_lifetime_contribution_profit_display from authenticated;
grant select on public.customer_lifetime_contribution_profit_display to authenticated;
grant select on public.customer_lifetime_contribution_profit_display to service_role;

comment on view public.customer_cohort_cost_allocation_display is
  'Task 25 exact-text display surface for explicit cohort cost allocations.';

comment on view public.customer_lifetime_contribution_profit_display is
  'Task 25 exact-text display surface for Lifetime Contribution Profit and each included cost component.';
