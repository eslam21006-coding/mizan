alter table public.customer_cohort_cost_allocations
  add column eligibility_confirmed boolean not null default false;

comment on column public.customer_cohort_cost_allocations.eligibility_confirmed is
  'Explicit user confirmation that a positive allocation is eligible for Lifetime Contribution Profit. Existing positive allocations default to false and must be reviewed before the metric becomes available again.';

create or replace function public.save_customer_cohort_cost_allocations(
  p_business_id uuid,
  p_cohort_month date,
  p_allocations jsonb
)
returns date
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  allocation jsonb;
  cost_type_value text;
  amount_value numeric;
  method_value text;
  note_value text;
  eligibility_value boolean;
  seen_types text[] := array[]::text[];
  required_types constant text[] := array[
    'acquisition',
    'variable_fulfillment',
    'other_variable',
    'payment_processing'
  ]::text[];
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to save customer lifetime costs.';
  end if;

  if not (select private.can_manage_business(p_business_id)) then
    raise insufficient_privilege using message = 'Only the business owner or an admin can save customer lifetime cost allocations.';
  end if;

  if p_cohort_month is null
    or p_cohort_month <> date_trunc('month', p_cohort_month)::date then
    raise invalid_parameter_value using message = 'First-purchase month must be the first day of a calendar month.';
  end if;

  if not exists (
    select 1
    from public.customer_acquisition_cohorts as acquisition_group
    where acquisition_group.business_id = p_business_id
      and acquisition_group.cohort_month = p_cohort_month
  ) then
    raise invalid_parameter_value using message = 'Customer acquisition group does not exist for this business.';
  end if;

  if jsonb_typeof(p_allocations) is distinct from 'array'
    or jsonb_array_length(p_allocations) <> 4 then
    raise invalid_parameter_value using message = 'Exactly four lifetime contribution cost categories are required.';
  end if;

  for allocation in select value from jsonb_array_elements(p_allocations)
  loop
    cost_type_value := btrim(coalesce(allocation ->> 'cost_type', ''));
    if not (cost_type_value = any(required_types))
      or cost_type_value = any(seen_types) then
      raise invalid_parameter_value using message = 'Lifetime contribution cost categories must be valid and unique.';
    end if;
    seen_types := array_append(seen_types, cost_type_value);

    begin
      amount_value := (allocation ->> 'amount')::numeric;
    exception when others then
      raise invalid_parameter_value using message = 'Lifetime contribution cost amount must be numeric.';
    end;
    if amount_value is null or amount_value < 0 then
      raise invalid_parameter_value using message = 'Lifetime contribution cost amount must be non-negative.';
    end if;

    method_value := btrim(coalesce(allocation ->> 'attribution_method', ''));
    if method_value not in ('direct_actual', 'explicit_allocation') then
      raise invalid_parameter_value using message = 'Attribution method must be direct_actual or explicit_allocation.';
    end if;

    note_value := nullif(btrim(coalesce(allocation ->> 'note', '')), '');
    if note_value is not null and char_length(note_value) > 500 then
      raise invalid_parameter_value using message = 'Allocation note is too long.';
    end if;

    begin
      eligibility_value := coalesce((allocation ->> 'eligibility_confirmed')::boolean, false);
    exception when others then
      raise invalid_parameter_value using message = 'Cost eligibility confirmation must be boolean.';
    end;

    if amount_value > 0 and not eligibility_value then
      raise invalid_parameter_value using message = 'Every positive lifetime contribution cost must be explicitly confirmed as eligible.';
    end if;

    insert into public.customer_cohort_cost_allocations (
      business_id,
      cohort_month,
      cost_type,
      amount,
      attribution_method,
      note,
      eligibility_confirmed,
      created_by_user_id,
      updated_by_user_id
    ) values (
      p_business_id,
      p_cohort_month,
      cost_type_value,
      amount_value,
      method_value,
      note_value,
      eligibility_value,
      (select auth.uid()),
      (select auth.uid())
    )
    on conflict (business_id, cohort_month, cost_type) do update set
      amount = excluded.amount,
      attribution_method = excluded.attribution_method,
      note = excluded.note,
      eligibility_confirmed = excluded.eligibility_confirmed,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now();
  end loop;

  if not (required_types <@ seen_types and seen_types <@ required_types) then
    raise invalid_parameter_value using message = 'All four lifetime contribution cost categories are required.';
  end if;

  return p_cohort_month;
end;
$$;

revoke all on function public.save_customer_cohort_cost_allocations(uuid, date, jsonb) from public;
revoke all on function public.save_customer_cohort_cost_allocations(uuid, date, jsonb) from anon;
revoke all on function public.save_customer_cohort_cost_allocations(uuid, date, jsonb) from authenticated;
grant execute on function public.save_customer_cohort_cost_allocations(uuid, date, jsonb) to authenticated;
grant execute on function public.save_customer_cohort_cost_allocations(uuid, date, jsonb) to service_role;

create or replace view public.customer_lifetime_contribution_profit
with (security_invoker = true, security_barrier = true)
as
with allocation_summary as (
  select
    allocation.business_id,
    allocation.cohort_month,
    count(*)::integer as allocation_count,
    coalesce(sum(allocation.amount) filter (where allocation.cost_type = 'acquisition'), 0::numeric) as acquisition_costs,
    coalesce(sum(allocation.amount) filter (where allocation.cost_type = 'variable_fulfillment'), 0::numeric) as variable_fulfillment_costs,
    coalesce(sum(allocation.amount) filter (where allocation.cost_type = 'other_variable'), 0::numeric) as other_variable_costs,
    coalesce(sum(allocation.amount) filter (where allocation.cost_type = 'payment_processing'), 0::numeric) as payment_processing_costs,
    bool_or(allocation.attribution_method = 'explicit_allocation') as uses_explicit_allocation,
    bool_and(allocation.amount = 0 or allocation.eligibility_confirmed) as eligibility_complete
  from public.customer_cohort_cost_allocations as allocation
  group by allocation.business_id, allocation.cohort_month
),
ready_summary as (
  select
    summary.*,
    summary.allocation_count = 4 and coalesce(summary.eligibility_complete, false) as is_complete
  from allocation_summary as summary
)
select
  observed.business_id,
  observed.cohort_month,
  observed.observation_month,
  observed.observation_cutoff_date,
  observed.original_cohort_size,
  observed.cumulative_net_cash_collected as lifetime_net_cash,
  observed.cumulative_net_cash_collected_text as lifetime_net_cash_text,
  coalesce(summary.acquisition_costs, 0::numeric) as acquisition_costs,
  coalesce(summary.variable_fulfillment_costs, 0::numeric) as variable_fulfillment_costs,
  coalesce(summary.other_variable_costs, 0::numeric) as other_variable_costs,
  coalesce(summary.payment_processing_costs, 0::numeric) as payment_processing_costs,
  coalesce(summary.is_complete, false) as allocation_complete,
  coalesce(summary.uses_explicit_allocation, false) as uses_explicit_allocation,
  case
    when coalesce(summary.is_complete, false) then
      observed.cumulative_net_cash_collected
      - summary.acquisition_costs
      - summary.variable_fulfillment_costs
      - summary.other_variable_costs
      - summary.payment_processing_costs
    else null
  end as lifetime_contribution_profit,
  case
    when coalesce(summary.is_complete, false) then
      (
        observed.cumulative_net_cash_collected
        - summary.acquisition_costs
        - summary.variable_fulfillment_costs
        - summary.other_variable_costs
        - summary.payment_processing_costs
      ) / observed.original_cohort_size::numeric
    else null
  end as lifetime_contribution_profit_per_customer,
  case
    when coalesce(summary.is_complete, false) then
      trim_scale(
        observed.cumulative_net_cash_collected
        - summary.acquisition_costs
        - summary.variable_fulfillment_costs
        - summary.other_variable_costs
        - summary.payment_processing_costs
      )::text
    else null
  end as lifetime_contribution_profit_text,
  case
    when coalesce(summary.is_complete, false) then
      trim_scale(
        (
          observed.cumulative_net_cash_collected
          - summary.acquisition_costs
          - summary.variable_fulfillment_costs
          - summary.other_variable_costs
          - summary.payment_processing_costs
        ) / observed.original_cohort_size::numeric
      )::text
    else null
  end as lifetime_contribution_profit_per_customer_text,
  observed.currency
from public.customer_observed_ltv as observed
left join ready_summary as summary
  on summary.business_id = observed.business_id
 and summary.cohort_month = observed.cohort_month;

revoke all on public.customer_lifetime_contribution_profit from public;
revoke all on public.customer_lifetime_contribution_profit from anon;
revoke all on public.customer_lifetime_contribution_profit from authenticated;
grant select on public.customer_lifetime_contribution_profit to authenticated;
grant select on public.customer_lifetime_contribution_profit to service_role;

create or replace view public.customer_cohort_cost_allocation_display
with (security_invoker = true, security_barrier = true)
as
select
  allocation.id,
  allocation.business_id,
  allocation.cohort_month,
  allocation.cost_type,
  allocation.amount,
  trim_scale(allocation.amount)::text as amount_text,
  allocation.attribution_method,
  allocation.note,
  allocation.created_at,
  allocation.updated_at,
  allocation.eligibility_confirmed
from public.customer_cohort_cost_allocations as allocation;

revoke all on public.customer_cohort_cost_allocation_display from public;
revoke all on public.customer_cohort_cost_allocation_display from anon;
revoke all on public.customer_cohort_cost_allocation_display from authenticated;
grant select on public.customer_cohort_cost_allocation_display to authenticated;
grant select on public.customer_cohort_cost_allocation_display to service_role;

comment on view public.customer_lifetime_contribution_profit is
  'Lifetime Contribution Profit by first-purchase customer group. Positive costs count only after explicit eligibility confirmation; fixed monthly overhead remains excluded. Existing unreviewed positive allocations keep the metric unavailable.';

comment on view public.customer_cohort_cost_allocation_display is
  'Exact-text display surface for customer-group lifetime cost allocations, including explicit cost-eligibility confirmation.';