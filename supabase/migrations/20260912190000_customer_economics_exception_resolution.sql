-- Task 5: exception-only Customer Economics resolution and explicit historical corrections.
-- This migration never creates a second expense amount. Manual overrides only redistribute
-- an existing authoritative monthly expense pool across trusted acquisition groups.

create table public.customer_economics_manual_overrides (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  authoritative_source_type text not null
    check (authoritative_source_type = 'monthly_expense_entry'),
  authoritative_source_id uuid not null,
  authoritative_amount_snapshot numeric(24,8) not null
    check (authoritative_amount_snapshot > 0),
  reason text not null check (
    char_length(btrim(reason)) between 1 and 500
  ),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  superseded_at timestamptz,
  constraint customer_economics_manual_overrides_superseded_check
    check (superseded_at is null or superseded_at >= created_at)
);

create unique index customer_economics_manual_overrides_one_active_source
  on public.customer_economics_manual_overrides (
    authoritative_source_type,
    authoritative_source_id
  )
  where superseded_at is null;

create index customer_economics_manual_overrides_business_created_idx
  on public.customer_economics_manual_overrides (business_id, created_at desc);

create table public.customer_economics_manual_override_allocations (
  override_id uuid not null
    references public.customer_economics_manual_overrides(id) on delete cascade,
  cohort_month date not null,
  allocated_amount numeric(24,8) not null check (allocated_amount > 0),
  primary key (override_id, cohort_month),
  constraint customer_economics_manual_override_allocations_month_check
    check (cohort_month = date_trunc('month', cohort_month)::date)
);

create table public.customer_economics_legacy_reconciliations (
  legacy_allocation_id uuid primary key
    references public.customer_cohort_cost_allocations(id) on delete restrict,
  manual_override_id uuid not null
    references public.customer_economics_manual_overrides(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index customer_economics_legacy_reconciliations_override_idx
  on public.customer_economics_legacy_reconciliations (manual_override_id);

create table public.monthly_historical_corrections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  monthly_period_id uuid not null references public.monthly_periods(id) on delete cascade,
  month_start date not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint monthly_historical_corrections_month_check
    check (month_start = date_trunc('month', month_start)::date)
);

create index monthly_historical_corrections_business_month_idx
  on public.monthly_historical_corrections (business_id, month_start desc, created_at desc);

alter table public.customer_economics_manual_overrides enable row level security;
alter table public.customer_economics_manual_override_allocations enable row level security;
alter table public.customer_economics_legacy_reconciliations enable row level security;
alter table public.monthly_historical_corrections enable row level security;

revoke all on public.customer_economics_manual_overrides from public;
revoke all on public.customer_economics_manual_overrides from anon;
revoke all on public.customer_economics_manual_overrides from authenticated;
revoke all on public.customer_economics_manual_override_allocations from public;
revoke all on public.customer_economics_manual_override_allocations from anon;
revoke all on public.customer_economics_manual_override_allocations from authenticated;
revoke all on public.customer_economics_legacy_reconciliations from public;
revoke all on public.customer_economics_legacy_reconciliations from anon;
revoke all on public.customer_economics_legacy_reconciliations from authenticated;
revoke all on public.monthly_historical_corrections from public;
revoke all on public.monthly_historical_corrections from anon;
revoke all on public.monthly_historical_corrections from authenticated;

grant select on public.customer_economics_manual_overrides to authenticated;
grant select on public.customer_economics_manual_override_allocations to authenticated;
grant select on public.customer_economics_legacy_reconciliations to authenticated;
grant select on public.monthly_historical_corrections to authenticated;

grant all on public.customer_economics_manual_overrides to service_role;
grant all on public.customer_economics_manual_override_allocations to service_role;
grant all on public.customer_economics_legacy_reconciliations to service_role;
grant all on public.monthly_historical_corrections to service_role;

create policy customer_economics_manual_overrides_select
on public.customer_economics_manual_overrides for select
to authenticated
using ((select private.can_read_business(business_id)));

create policy customer_economics_manual_override_allocations_select
on public.customer_economics_manual_override_allocations for select
to authenticated
using (
  exists (
    select 1
    from public.customer_economics_manual_overrides as manual_override
    where manual_override.id = override_id
      and (select private.can_read_business(manual_override.business_id))
  )
);

create policy customer_economics_legacy_reconciliations_select
on public.customer_economics_legacy_reconciliations for select
to authenticated
using ((select private.can_read_business(business_id)));

create policy monthly_historical_corrections_select
on public.monthly_historical_corrections for select
to authenticated
using ((select private.can_read_business(business_id)));

create or replace view public.customer_economics_manual_override_status
with (security_invoker = true, security_barrier = true)
as
with active_overrides as (
  select manual_override.*
  from public.customer_economics_manual_overrides as manual_override
  where manual_override.superseded_at is null
),
allocation_summary as (
  select
    manual_override.id as override_id,
    count(allocation.cohort_month)::bigint as allocation_count,
    coalesce(sum(allocation.allocated_amount), 0::numeric) as allocated_amount,
    count(allocation.cohort_month) filter (
      where exists (
        select 1
        from public.customer_acquisition_cohorts as cohort
        where cohort.business_id = manual_override.business_id
          and cohort.cohort_month = allocation.cohort_month
      )
    )::bigint as trusted_allocation_count
  from active_overrides as manual_override
  left join public.customer_economics_manual_override_allocations as allocation
    on allocation.override_id = manual_override.id
  group by manual_override.id
),
plan_counts as (
  select
    plan.authoritative_source_type,
    plan.authoritative_source_id,
    count(*)::bigint as plan_count
  from public.customer_economics_cost_pool_plan as plan
  group by plan.authoritative_source_type, plan.authoritative_source_id
)
select
  manual_override.id as override_id,
  manual_override.business_id,
  manual_override.authoritative_source_type,
  manual_override.authoritative_source_id,
  manual_override.authoritative_amount_snapshot,
  plan.authoritative_amount as current_authoritative_amount,
  coalesce(summary.allocated_amount, 0::numeric) as allocated_amount,
  coalesce(summary.allocation_count, 0) as allocation_count,
  coalesce(history.is_complete, false) as transaction_history_complete,
  coalesce(summary.trusted_allocation_count, 0) = coalesce(summary.allocation_count, 0)
    and coalesce(summary.allocation_count, 0) > 0 as targets_trusted,
  case
    when coalesce(plan_counts.plan_count, 0) <> 1 then false
    when plan.cost_eligibility <> 'eligible' then false
    when plan.authoritative_amount is null or plan.authoritative_amount <= 0 then false
    when plan.authoritative_amount <> manual_override.authoritative_amount_snapshot then false
    when not coalesce(history.is_complete, false) then false
    when coalesce(summary.allocation_count, 0) <= 0 then false
    when coalesce(summary.trusted_allocation_count, 0) <> coalesce(summary.allocation_count, 0) then false
    when coalesce(summary.allocated_amount, 0::numeric) <> plan.authoritative_amount then false
    else true
  end as is_valid,
  case
    when coalesce(plan_counts.plan_count, 0) <> 1 then 'MANUAL_OVERRIDE_SOURCE_MISSING_OR_DUPLICATE'
    when plan.cost_eligibility <> 'eligible' then 'MANUAL_OVERRIDE_SOURCE_NOT_ELIGIBLE'
    when plan.authoritative_amount is null then 'MANUAL_OVERRIDE_AUTHORITATIVE_AMOUNT_MISSING'
    when plan.authoritative_amount <= 0 then 'MANUAL_OVERRIDE_AUTHORITATIVE_AMOUNT_NOT_POSITIVE'
    when plan.authoritative_amount <> manual_override.authoritative_amount_snapshot then 'MANUAL_OVERRIDE_STALE_AMOUNT'
    when not coalesce(history.is_complete, false) then 'INCOMPLETE_TRANSACTION_HISTORY'
    when coalesce(summary.allocation_count, 0) <= 0 then 'MANUAL_OVERRIDE_EMPTY'
    when coalesce(summary.trusted_allocation_count, 0) <> coalesce(summary.allocation_count, 0) then 'MANUAL_OVERRIDE_UNTRUSTED_COHORT'
    when coalesce(summary.allocated_amount, 0::numeric) <> plan.authoritative_amount then 'MANUAL_OVERRIDE_SUM_MISMATCH'
    else null
  end as invalid_reason,
  manual_override.reason,
  manual_override.created_by_user_id,
  manual_override.created_at,
  plan.activity_month,
  plan.expense_item_id,
  plan.expense_name_snapshot,
  plan.category_snapshot,
  plan.currency
from active_overrides as manual_override
left join plan_counts
  on plan_counts.authoritative_source_type = manual_override.authoritative_source_type
 and plan_counts.authoritative_source_id = manual_override.authoritative_source_id
left join public.customer_economics_cost_pool_plan as plan
  on plan.authoritative_source_type = manual_override.authoritative_source_type
 and plan.authoritative_source_id = manual_override.authoritative_source_id
left join allocation_summary as summary
  on summary.override_id = manual_override.id
left join public.business_transaction_history_status as history
  on history.business_id = manual_override.business_id;

revoke all on public.customer_economics_manual_override_status from public;
revoke all on public.customer_economics_manual_override_status from anon;
revoke all on public.customer_economics_manual_override_status from authenticated;
grant select on public.customer_economics_manual_override_status to authenticated;
grant select on public.customer_economics_manual_override_status to service_role;

create or replace function private.create_customer_economics_manual_override(
  p_business_id uuid,
  p_authoritative_source_id uuid,
  p_allocations jsonb,
  p_reason text,
  p_require_exception boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_row record;
  plan_count integer;
  allocation jsonb;
  cohort_value date;
  amount_value numeric;
  cohort_values date[] := array[]::date[];
  amount_values numeric[] := array[]::numeric[];
  allocation_total numeric := 0::numeric;
  override_id uuid;
  item_index integer;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to resolve Customer Economics exceptions.';
  end if;

  if not (select private.can_manage_business(p_business_id)) then
    raise insufficient_privilege using message = 'Only the business owner or an admin can resolve Customer Economics exceptions.';
  end if;

  if p_authoritative_source_id is null then
    raise invalid_parameter_value using message = 'An authoritative cost pool is required.';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then
    raise invalid_parameter_value using message = 'A review reason between 1 and 500 characters is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'customer-economics-override:' || p_authoritative_source_id::text,
      0
    )
  );

  select count(*)::integer
  into plan_count
  from public.customer_economics_cost_pool_plan as plan
  where plan.business_id = p_business_id
    and plan.authoritative_source_type = 'monthly_expense_entry'
    and plan.authoritative_source_id = p_authoritative_source_id;

  if plan_count <> 1 then
    raise invalid_parameter_value using message = 'The authoritative cost pool is missing or ambiguous.';
  end if;

  select plan.*
  into plan_row
  from public.customer_economics_cost_pool_plan as plan
  where plan.business_id = p_business_id
    and plan.authoritative_source_type = 'monthly_expense_entry'
    and plan.authoritative_source_id = p_authoritative_source_id;

  if plan_row.cost_eligibility <> 'eligible' then
    raise invalid_parameter_value using message = 'Excluded costs cannot be manually allocated.';
  end if;

  if plan_row.authoritative_amount is null or plan_row.authoritative_amount <= 0 then
    raise invalid_parameter_value using message = 'The authoritative cost pool must be a known positive amount.';
  end if;

  if not coalesce(plan_row.transaction_history_complete, false) then
    raise invalid_parameter_value using message = 'Transaction history must be complete before acquisition groups can be used for a manual override.';
  end if;

  if coalesce(p_require_exception, true) and plan_row.allocation_exception_reason is null then
    raise invalid_parameter_value using message = 'Manual overrides are only available for unresolved Customer Economics exceptions.';
  end if;

  if jsonb_typeof(p_allocations) is distinct from 'array'
     or jsonb_array_length(p_allocations) = 0 then
    raise invalid_parameter_value using message = 'At least one acquisition-group allocation is required.';
  end if;

  for allocation in select value from jsonb_array_elements(p_allocations)
  loop
    begin
      cohort_value := (allocation ->> 'cohort_month')::date;
      amount_value := (allocation ->> 'amount')::numeric;
    exception when others then
      raise invalid_parameter_value using message = 'Each allocation requires a valid cohort month and numeric amount.';
    end;

    if cohort_value is null
       or cohort_value <> date_trunc('month', cohort_value)::date then
      raise invalid_parameter_value using message = 'Each acquisition group must be a calendar month.';
    end if;

    if cohort_value = any(cohort_values) then
      raise invalid_parameter_value using message = 'Each acquisition group may appear only once.';
    end if;

    if amount_value is null or amount_value <= 0 then
      raise invalid_parameter_value using message = 'Manual override allocation amounts must be positive.';
    end if;

    if not exists (
      select 1
      from public.customer_acquisition_cohorts as cohort
      where cohort.business_id = p_business_id
        and cohort.cohort_month = cohort_value
    ) then
      raise invalid_parameter_value using message = 'Every manual override target must be a trusted first-purchase group.';
    end if;

    cohort_values := array_append(cohort_values, cohort_value);
    amount_values := array_append(amount_values, amount_value);
    allocation_total := allocation_total + amount_value;
  end loop;

  if allocation_total <> plan_row.authoritative_amount then
    raise invalid_parameter_value using message = 'Manual override allocations must equal the authoritative cost pool exactly.';
  end if;

  update public.customer_economics_manual_overrides
  set superseded_at = now()
  where authoritative_source_type = 'monthly_expense_entry'
    and authoritative_source_id = p_authoritative_source_id
    and superseded_at is null;

  insert into public.customer_economics_manual_overrides (
    business_id,
    authoritative_source_type,
    authoritative_source_id,
    authoritative_amount_snapshot,
    reason,
    created_by_user_id
  ) values (
    p_business_id,
    'monthly_expense_entry',
    p_authoritative_source_id,
    plan_row.authoritative_amount,
    btrim(p_reason),
    (select auth.uid())
  )
  returning id into override_id;

  if array_length(cohort_values, 1) is not null then
    for item_index in 1..array_length(cohort_values, 1)
    loop
      insert into public.customer_economics_manual_override_allocations (
        override_id,
        cohort_month,
        allocated_amount
      ) values (
        override_id,
        cohort_values[item_index],
        amount_values[item_index]
      );
    end loop;
  end if;

  return override_id;
end;
$$;

revoke all on function private.create_customer_economics_manual_override(uuid, uuid, jsonb, text, boolean) from public;
revoke all on function private.create_customer_economics_manual_override(uuid, uuid, jsonb, text, boolean) from anon;
revoke all on function private.create_customer_economics_manual_override(uuid, uuid, jsonb, text, boolean) from authenticated;
revoke all on function private.create_customer_economics_manual_override(uuid, uuid, jsonb, text, boolean) from service_role;

create or replace function public.save_customer_economics_manual_override(
  p_business_id uuid,
  p_authoritative_source_id uuid,
  p_allocations jsonb,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.create_customer_economics_manual_override(
    p_business_id,
    p_authoritative_source_id,
    p_allocations,
    p_reason,
    true
  );
end;
$$;

revoke all on function public.save_customer_economics_manual_override(uuid, uuid, jsonb, text) from public;
revoke all on function public.save_customer_economics_manual_override(uuid, uuid, jsonb, text) from anon;
revoke all on function public.save_customer_economics_manual_override(uuid, uuid, jsonb, text) from authenticated;
grant execute on function public.save_customer_economics_manual_override(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.save_customer_economics_manual_override(uuid, uuid, jsonb, text) to service_role;

create or replace function public.reconcile_customer_economics_legacy_allocations(
  p_business_id uuid,
  p_authoritative_source_id uuid,
  p_legacy_allocation_ids jsonb,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_row record;
  plan_count integer;
  legacy_id_value uuid;
  legacy_row record;
  legacy_ids uuid[] := array[]::uuid[];
  expected_cost_type text;
  legacy_total numeric := 0::numeric;
  override_allocations jsonb := '[]'::jsonb;
  override_id uuid;
  item jsonb;
  mapped_count integer;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to reconcile legacy allocations.';
  end if;

  if not (select private.can_manage_business(p_business_id)) then
    raise insufficient_privilege using message = 'Only the business owner or an admin can reconcile legacy allocations.';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 500 then
    raise invalid_parameter_value using message = 'A reconciliation reason between 1 and 500 characters is required.';
  end if;

  if jsonb_typeof(p_legacy_allocation_ids) is distinct from 'array'
     or jsonb_array_length(p_legacy_allocation_ids) = 0 then
    raise invalid_parameter_value using message = 'Select at least one legacy allocation to reconcile.';
  end if;

  select count(*)::integer
  into plan_count
  from public.customer_economics_cost_pool_plan as plan
  where plan.business_id = p_business_id
    and plan.authoritative_source_type = 'monthly_expense_entry'
    and plan.authoritative_source_id = p_authoritative_source_id;

  if plan_count <> 1 then
    raise invalid_parameter_value using message = 'The authoritative cost pool is missing or ambiguous.';
  end if;

  select plan.*
  into plan_row
  from public.customer_economics_cost_pool_plan as plan
  where plan.business_id = p_business_id
    and plan.authoritative_source_type = 'monthly_expense_entry'
    and plan.authoritative_source_id = p_authoritative_source_id;

  if plan_row.cost_eligibility <> 'eligible'
     or plan_row.authoritative_amount is null
     or plan_row.authoritative_amount <= 0 then
    raise invalid_parameter_value using message = 'Legacy allocations can only be reconciled to a known positive eligible cost pool.';
  end if;

  if not coalesce(plan_row.transaction_history_complete, false) then
    raise invalid_parameter_value using message = 'Transaction history must be complete before legacy acquisition groups can be reconciled.';
  end if;

  expected_cost_type := case plan_row.category_snapshot
    when 'acquisition' then 'acquisition'
    when 'fulfillment' then 'variable_fulfillment'
    when 'overhead' then 'other_variable'
    when 'financial' then 'payment_processing'
    else null
  end;

  if expected_cost_type is null then
    raise invalid_parameter_value using message = 'The authoritative cost category cannot be mapped to a legacy cost type.';
  end if;

  for item in select value from jsonb_array_elements(p_legacy_allocation_ids)
  loop
    begin
      legacy_id_value := trim(both '"' from item::text)::uuid;
    exception when others then
      raise invalid_parameter_value using message = 'Legacy allocation identifiers must be valid UUIDs.';
    end;

    if legacy_id_value = any(legacy_ids) then
      raise invalid_parameter_value using message = 'Legacy allocation identifiers must be unique.';
    end if;

    select legacy.*
    into legacy_row
    from public.customer_economics_legacy_manual_allocations as legacy
    where legacy.id = legacy_id_value
      and legacy.business_id = p_business_id;

    if not found then
      raise invalid_parameter_value using message = 'A selected legacy allocation does not belong to this business.';
    end if;

    if exists (
      select 1
      from public.customer_economics_legacy_reconciliations as reconciliation
      where reconciliation.legacy_allocation_id = legacy_id_value
    ) then
      raise invalid_parameter_value using message = 'A selected legacy allocation has already been reconciled.';
    end if;

    if legacy_row.cost_type <> expected_cost_type then
      raise invalid_parameter_value using message = 'Legacy cost type must match the authoritative expense category.';
    end if;

    if not exists (
      select 1
      from public.customer_acquisition_cohorts as cohort
      where cohort.business_id = p_business_id
        and cohort.cohort_month = legacy_row.cohort_month
    ) then
      raise invalid_parameter_value using message = 'Every legacy allocation must point to a trusted first-purchase group.';
    end if;

    legacy_ids := array_append(legacy_ids, legacy_id_value);
    legacy_total := legacy_total + legacy_row.amount;

    if legacy_row.amount > 0 then
      override_allocations := override_allocations || jsonb_build_array(
        jsonb_build_object(
          'cohort_month', legacy_row.cohort_month::text,
          'amount', legacy_row.amount::text
        )
      );
    end if;
  end loop;

  if legacy_total <> plan_row.authoritative_amount then
    raise invalid_parameter_value using message = 'Selected legacy allocations must equal the authoritative cost pool exactly.';
  end if;

  if jsonb_array_length(override_allocations) = 0 then
    raise invalid_parameter_value using message = 'A positive authoritative cost pool requires at least one positive legacy allocation.';
  end if;

  override_id := private.create_customer_economics_manual_override(
    p_business_id,
    p_authoritative_source_id,
    override_allocations,
    p_reason,
    false
  );

  insert into public.customer_economics_legacy_reconciliations (
    legacy_allocation_id,
    manual_override_id,
    business_id,
    created_by_user_id
  )
  select
    legacy_id,
    override_id,
    p_business_id,
    (select auth.uid())
  from unnest(legacy_ids) as legacy_id;

  get diagnostics mapped_count = row_count;
  if mapped_count <> array_length(legacy_ids, 1) then
    raise exception 'Legacy reconciliation audit mapping was incomplete.';
  end if;

  return override_id;
end;
$$;

revoke all on function public.reconcile_customer_economics_legacy_allocations(uuid, uuid, jsonb, text) from public;
revoke all on function public.reconcile_customer_economics_legacy_allocations(uuid, uuid, jsonb, text) from anon;
revoke all on function public.reconcile_customer_economics_legacy_allocations(uuid, uuid, jsonb, text) from authenticated;
grant execute on function public.reconcile_customer_economics_legacy_allocations(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.reconcile_customer_economics_legacy_allocations(uuid, uuid, jsonb, text) to service_role;

-- Preserve the Task 2 allocation surface. Active manual overrides suppress automatic allocation
-- for that exact authoritative source. Only a currently valid override enters the engine.
create or replace view public.customer_economics_cost_allocations
with (security_invoker = true, security_barrier = true)
as
with active_override_sources as (
  select
    manual_override.authoritative_source_type,
    manual_override.authoritative_source_id
  from public.customer_economics_manual_overrides as manual_override
  where manual_override.superseded_at is null
),
candidates as (
  select
    plan.authoritative_source_id,
    plan.authoritative_source_type,
    plan.business_id,
    plan.activity_month,
    plan.expense_item_id,
    plan.expense_name_snapshot,
    plan.category_snapshot,
    plan.default_allocation_driver,
    plan.authoritative_amount,
    plan.currency,
    evidence.cohort_month,
    evidence.allocation_weight,
    plan.total_weight,
    row_number() over (
      partition by plan.authoritative_source_type, plan.authoritative_source_id
      order by evidence.cohort_month
    ) as allocation_rank,
    count(*) over (
      partition by plan.authoritative_source_type, plan.authoritative_source_id
    ) as allocation_count,
    plan.authoritative_amount * evidence.allocation_weight / plan.total_weight as raw_allocation_amount
  from public.customer_economics_cost_pool_plan as plan
  join public.customer_economics_activity_evidence as evidence
    on evidence.business_id = plan.business_id
   and evidence.activity_month = plan.activity_month
   and evidence.allocation_driver = plan.default_allocation_driver
  where plan.can_allocate
    and plan.authoritative_amount > 0
    and not exists (
      select 1
      from active_override_sources as override_source
      where override_source.authoritative_source_type = plan.authoritative_source_type
        and override_source.authoritative_source_id = plan.authoritative_source_id
    )
),
ranked as (
  select
    candidates.*,
    sum(
      case
        when candidates.allocation_rank < candidates.allocation_count
          then candidates.raw_allocation_amount
        else 0::numeric
      end
    ) over (
      partition by candidates.authoritative_source_type, candidates.authoritative_source_id
    ) as prior_allocated_amount
  from candidates
),
automatic_allocations as (
  select
    ranked.authoritative_source_id,
    ranked.authoritative_source_type,
    ranked.business_id,
    ranked.activity_month,
    ranked.cohort_month,
    ranked.expense_item_id,
    ranked.expense_name_snapshot,
    ranked.category_snapshot,
    ranked.default_allocation_driver as allocation_driver,
    'deterministic_estimate'::text as allocation_provenance,
    ranked.allocation_weight,
    ranked.total_weight,
    case
      when ranked.allocation_rank = ranked.allocation_count
        then ranked.authoritative_amount - ranked.prior_allocated_amount
      else ranked.raw_allocation_amount
    end as allocated_amount,
    ranked.currency
  from ranked
),
manual_allocations as (
  select
    status.authoritative_source_id,
    status.authoritative_source_type,
    status.business_id,
    status.activity_month,
    allocation.cohort_month,
    status.expense_item_id,
    status.expense_name_snapshot,
    status.category_snapshot,
    'manual_override'::text as allocation_driver,
    'manual_override'::text as allocation_provenance,
    allocation.allocated_amount as allocation_weight,
    status.current_authoritative_amount as total_weight,
    allocation.allocated_amount,
    status.currency
  from public.customer_economics_manual_override_status as status
  join public.customer_economics_manual_override_allocations as allocation
    on allocation.override_id = status.override_id
  where status.is_valid
)
select * from automatic_allocations
union all
select * from manual_allocations;

revoke all on public.customer_economics_cost_allocations from public;
revoke all on public.customer_economics_cost_allocations from anon;
revoke all on public.customer_economics_cost_allocations from authenticated;
grant select on public.customer_economics_cost_allocations to authenticated;
grant select on public.customer_economics_cost_allocations to service_role;

comment on view public.customer_economics_cost_allocations is
  'Reconciled Customer Economics allocation surface. Deterministic automatic rows and valid exception-only manual overrides distribute existing authoritative pools without creating new costs.';

create or replace view public.customer_economics_cost_pool_reconciliation
with (security_invoker = true, security_barrier = true)
as
with allocated as (
  select
    allocation.authoritative_source_type,
    allocation.authoritative_source_id,
    sum(allocation.allocated_amount) as allocated_amount
  from public.customer_economics_cost_allocations as allocation
  group by allocation.authoritative_source_type, allocation.authoritative_source_id
),
override_status as (
  select status.*
  from public.customer_economics_manual_override_status as status
)
select
  plan.authoritative_source_id,
  plan.authoritative_source_type,
  plan.business_id,
  plan.activity_month,
  plan.expense_item_id,
  plan.expense_name_snapshot,
  plan.category_snapshot,
  plan.cost_eligibility,
  plan.default_allocation_driver,
  plan.authoritative_amount,
  case
    when plan.authoritative_amount is null then null
    else coalesce(allocated.allocated_amount, 0::numeric)
  end as allocated_amount,
  case
    when plan.authoritative_amount is null then null
    when override_status.override_id is not null and override_status.is_valid then 0::numeric
    when override_status.override_id is not null then plan.authoritative_amount
    else plan.unallocated_amount
  end as unallocated_amount,
  case
    when plan.cost_eligibility = 'excluded' then null
    when plan.authoritative_amount is null then null
    else
      plan.authoritative_amount
      - coalesce(allocated.allocated_amount, 0::numeric)
      - case
          when override_status.override_id is not null and override_status.is_valid then 0::numeric
          when override_status.override_id is not null then plan.authoritative_amount
          else plan.unallocated_amount
        end
  end as reconciliation_difference,
  case
    when plan.cost_eligibility = 'excluded' then null
    when plan.authoritative_amount is null then null
    when plan.unallocated_amount is null and override_status.override_id is null then null
    else
      plan.authoritative_amount
      = coalesce(allocated.allocated_amount, 0::numeric)
        + case
            when override_status.override_id is not null and override_status.is_valid then 0::numeric
            when override_status.override_id is not null then plan.authoritative_amount
            else plan.unallocated_amount
          end
  end as reconciles,
  case
    when override_status.override_id is not null and override_status.is_valid then 'estimated'
    when override_status.override_id is not null then 'incomplete'
    else plan.allocation_quality_state
  end as allocation_quality_state,
  case
    when override_status.override_id is not null and override_status.is_valid then null
    when override_status.override_id is not null then override_status.invalid_reason
    else plan.allocation_exception_reason
  end as allocation_exception_reason,
  plan.transaction_history_complete,
  plan.coverage_state,
  plan.currency
from public.customer_economics_cost_pool_plan as plan
left join allocated
  on allocated.authoritative_source_type = plan.authoritative_source_type
 and allocated.authoritative_source_id = plan.authoritative_source_id
left join override_status
  on override_status.authoritative_source_type = plan.authoritative_source_type
 and override_status.authoritative_source_id = plan.authoritative_source_id;

revoke all on public.customer_economics_cost_pool_reconciliation from public;
revoke all on public.customer_economics_cost_pool_reconciliation from anon;
revoke all on public.customer_economics_cost_pool_reconciliation from authenticated;
grant select on public.customer_economics_cost_pool_reconciliation to authenticated;
grant select on public.customer_economics_cost_pool_reconciliation to service_role;

create or replace view public.customer_economics_period_quality
with (security_invoker = true, security_barrier = true)
as
with cost_quality as (
  select
    reconciliation.business_id,
    reconciliation.activity_month,
    count(*) filter (
      where reconciliation.cost_eligibility = 'eligible'
        and reconciliation.allocation_quality_state = 'incomplete'
    )::bigint as incomplete_cost_pool_count,
    count(*) filter (
      where reconciliation.cost_eligibility = 'eligible'
        and reconciliation.allocation_quality_state = 'estimated'
    )::bigint as estimated_cost_pool_count,
    count(*) filter (
      where reconciliation.cost_eligibility = 'eligible'
        and reconciliation.reconciles is false
    )::bigint as unreconciled_cost_pool_count
  from public.customer_economics_cost_pool_reconciliation as reconciliation
  group by reconciliation.business_id, reconciliation.activity_month
),
legacy as (
  select
    legacy.business_id,
    legacy.cohort_month as activity_month,
    count(*)::bigint as unresolved_legacy_count
  from public.customer_economics_legacy_manual_allocations as legacy
  left join public.customer_economics_legacy_reconciliations as reconciliation
    on reconciliation.legacy_allocation_id = legacy.id
  where not legacy.eligible_for_new_engine
    and reconciliation.legacy_allocation_id is null
  group by legacy.business_id, legacy.cohort_month
)
select
  financial_basis.business_id,
  financial_basis.activity_month,
  coalesce(history.is_complete, false) as transaction_history_complete,
  coverage.coverage_state,
  coverage.coverage_difference,
  coverage.coverage_tolerance,
  coalesce(cost_quality.incomplete_cost_pool_count, 0) as incomplete_cost_pool_count,
  coalesce(cost_quality.estimated_cost_pool_count, 0) as estimated_cost_pool_count,
  coalesce(cost_quality.unreconciled_cost_pool_count, 0) as unreconciled_cost_pool_count,
  coalesce(legacy.unresolved_legacy_count, 0) as unresolved_legacy_count,
  case
    when not coalesce(history.is_complete, false) then 'incomplete'
    when coverage.coverage_state <> 'COVERED' then 'incomplete'
    when coalesce(cost_quality.incomplete_cost_pool_count, 0) > 0 then 'incomplete'
    when coalesce(cost_quality.unreconciled_cost_pool_count, 0) > 0 then 'incomplete'
    when coalesce(legacy.unresolved_legacy_count, 0) > 0 then 'incomplete'
    when coalesce(cost_quality.estimated_cost_pool_count, 0) > 0 then 'estimated'
    else 'actual'
  end as quality_state,
  financial_basis.currency
from public.customer_economics_monthly_financial_basis as financial_basis
left join public.business_transaction_history_status as history
  on history.business_id = financial_basis.business_id
left join public.customer_economics_revenue_coverage as coverage
  on coverage.business_id = financial_basis.business_id
 and coverage.activity_month = financial_basis.activity_month
left join cost_quality
  on cost_quality.business_id = financial_basis.business_id
 and cost_quality.activity_month = financial_basis.activity_month
left join legacy
  on legacy.business_id = financial_basis.business_id
 and legacy.activity_month = financial_basis.activity_month;

revoke all on public.customer_economics_period_quality from public;
revoke all on public.customer_economics_period_quality from anon;
revoke all on public.customer_economics_period_quality from authenticated;
grant select on public.customer_economics_period_quality to authenticated;
grant select on public.customer_economics_period_quality to service_role;

-- Keep Lifetime Contribution Profit on the reconciled allocation surface and stop a reconciled
-- legacy row from continuing to block its acquisition group.
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
    count(*) filter (where relevant.activity_month is not null)::bigint as relevant_activity_month_count,
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
  group by observation.business_id, observation.cohort_month, observation.observation_month
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
    count(allocation.authoritative_source_id) filter (
      where allocation.allocation_provenance = 'deterministic_estimate'
    )::bigint as automatic_allocation_count
  from public.customer_cohort_observations as observation
  left join public.customer_economics_cost_allocations as allocation
    on allocation.business_id = observation.business_id
   and allocation.cohort_month = observation.cohort_month
   and allocation.activity_month <= observation.observation_month
  group by observation.business_id, observation.cohort_month, observation.observation_month
),
legacy_by_cohort as (
  select
    legacy.business_id,
    legacy.cohort_month,
    count(*)::bigint as legacy_manual_allocation_count
  from public.customer_economics_legacy_manual_allocations as legacy
  left join public.customer_economics_legacy_reconciliations as reconciliation
    on reconciliation.legacy_allocation_id = legacy.id
  where reconciliation.legacy_allocation_id is null
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
    when metrics.quality_state <> 'incomplete' then metrics.lifetime_net_cash - metrics.lifetime_attributable_costs
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
      pg_catalog.trim_scale(metrics.lifetime_net_cash - metrics.lifetime_attributable_costs)::text
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
  pg_catalog.trim_scale(metrics.variable_financial_costs)::text as variable_financial_costs_text,
  pg_catalog.trim_scale(metrics.lifetime_attributable_costs)::text as lifetime_attributable_costs_text,
  metrics.is_current_observation
from metrics;

revoke all on public.customer_lifetime_contribution_profit_observations from public;
revoke all on public.customer_lifetime_contribution_profit_observations from anon;
revoke all on public.customer_lifetime_contribution_profit_observations from authenticated;
grant select on public.customer_lifetime_contribution_profit_observations to authenticated;
grant select on public.customer_lifetime_contribution_profit_observations to service_role;

create or replace view public.customer_economics_review_exceptions
with (security_invoker = true, security_barrier = true)
as
with history_exceptions as (
  select
    business.id as business_id,
    null::date as activity_month,
    'INCOMPLETE_TRANSACTION_HISTORY'::text as exception_code,
    null::uuid as authoritative_source_id,
    null::text as expense_name_snapshot,
    null::numeric as amount,
    business.base_currency as currency,
    false as can_manual_override,
    true as blocking
  from public.businesses as business
  left join public.business_transaction_history_status as history
    on history.business_id = business.id
  where not coalesce(history.is_complete, false)
),
coverage_exceptions as (
  select
    coverage.business_id,
    coverage.activity_month,
    coverage.coverage_state as exception_code,
    null::uuid as authoritative_source_id,
    null::text as expense_name_snapshot,
    coverage.coverage_difference as amount,
    coverage.currency,
    false as can_manual_override,
    true as blocking
  from public.customer_economics_revenue_coverage as coverage
  where coverage.coverage_state <> 'COVERED'
),
cost_exceptions as (
  select
    reconciliation.business_id,
    reconciliation.activity_month,
    reconciliation.allocation_exception_reason as exception_code,
    reconciliation.authoritative_source_id,
    reconciliation.expense_name_snapshot,
    reconciliation.unallocated_amount as amount,
    reconciliation.currency,
    reconciliation.cost_eligibility = 'eligible'
      and reconciliation.authoritative_amount is not null
      and reconciliation.authoritative_amount > 0
      and reconciliation.transaction_history_complete
      and reconciliation.allocation_exception_reason is not null as can_manual_override,
    true as blocking
  from public.customer_economics_cost_pool_reconciliation as reconciliation
  where reconciliation.cost_eligibility = 'eligible'
    and reconciliation.allocation_quality_state = 'incomplete'
    and reconciliation.allocation_exception_reason is not null
    and reconciliation.allocation_exception_reason not in (
      'INCOMPLETE_TRANSACTION_HISTORY',
      'REVENUE_COVERAGE_MISMATCH'
    )
),
reconciliation_exceptions as (
  select
    reconciliation.business_id,
    reconciliation.activity_month,
    'COST_RECONCILIATION_FAILED'::text as exception_code,
    reconciliation.authoritative_source_id,
    reconciliation.expense_name_snapshot,
    reconciliation.reconciliation_difference as amount,
    reconciliation.currency,
    false as can_manual_override,
    true as blocking
  from public.customer_economics_cost_pool_reconciliation as reconciliation
  where reconciliation.reconciles is false
),
legacy_exceptions as (
  select
    legacy.business_id,
    legacy.cohort_month as activity_month,
    'LEGACY_MANUAL_UNRECONCILED'::text as exception_code,
    null::uuid as authoritative_source_id,
    legacy.cost_type as expense_name_snapshot,
    legacy.amount,
    business.base_currency as currency,
    false as can_manual_override,
    true as blocking
  from public.customer_economics_legacy_manual_allocations as legacy
  join public.businesses as business on business.id = legacy.business_id
  left join public.customer_economics_legacy_reconciliations as reconciliation
    on reconciliation.legacy_allocation_id = legacy.id
  where reconciliation.legacy_allocation_id is null
)
select * from history_exceptions
union all select * from coverage_exceptions
union all select * from cost_exceptions
union all select * from reconciliation_exceptions
union all select * from legacy_exceptions;

revoke all on public.customer_economics_review_exceptions from public;
revoke all on public.customer_economics_review_exceptions from anon;
revoke all on public.customer_economics_review_exceptions from authenticated;
grant select on public.customer_economics_review_exceptions to authenticated;
grant select on public.customer_economics_review_exceptions to service_role;

-- Ordinary saves may create a missing backfilled period, but they may not alter an existing
-- historical period. Existing historical periods require the explicit audited correction RPC.
create or replace function public.save_monthly_actuals(
  target_business_id uuid,
  target_month_start date,
  target_new_customers integer,
  target_total_paying_customers integer,
  target_unallocated_gross numeric,
  target_unallocated_refunds numeric,
  target_adjustment_note text,
  target_revenue_entries jsonb,
  target_expense_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_timezone text;
  business_current_month date;
  existing_period boolean;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to save monthly actuals.';
  end if;

  if not (select private.can_manage_business(target_business_id)) then
    raise insufficient_privilege using message = 'Not allowed to manage monthly actuals for this business.';
  end if;

  select business.timezone
  into business_timezone
  from public.businesses as business
  where business.id = target_business_id;

  if not found then
    raise invalid_parameter_value using message = 'Business does not exist.';
  end if;

  if target_month_start is null
     or target_month_start <> date_trunc('month', target_month_start)::date then
    raise invalid_parameter_value using message = 'month_start must be the first day of a calendar month.';
  end if;

  business_current_month := date_trunc(
    'month',
    now() at time zone business_timezone
  )::date;

  select exists (
    select 1
    from public.monthly_periods as period
    where period.business_id = target_business_id
      and period.month_start = target_month_start
  ) into existing_period;

  if existing_period and target_month_start < business_current_month then
    raise invalid_parameter_value using message = 'Existing historical months require the explicit historical correction workflow.';
  end if;

  return private.save_monthly_actuals_preserve_missing(
    target_business_id,
    target_month_start,
    target_new_customers,
    target_total_paying_customers,
    target_unallocated_gross,
    target_unallocated_refunds,
    target_adjustment_note,
    target_revenue_entries,
    target_expense_entries
  );
end;
$$;

revoke all on function public.save_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) from public;
revoke all on function public.save_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) from anon;
revoke all on function public.save_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) from authenticated;
grant execute on function public.save_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) to authenticated;
grant execute on function public.save_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) to service_role;

-- Close the pre-existing bypass around the public historical guard.
revoke all on function private.save_monthly_actuals_preserve_missing(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) from public;
revoke all on function private.save_monthly_actuals_preserve_missing(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) from anon;
revoke all on function private.save_monthly_actuals_preserve_missing(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) from authenticated;
revoke all on function private.save_monthly_actuals_preserve_missing(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb) from service_role;

create or replace function private.monthly_actual_snapshot(
  p_business_id uuid,
  p_monthly_period_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'period', to_jsonb(period),
    'revenue_entries', coalesce((
      select jsonb_agg(to_jsonb(revenue_entry) order by revenue_entry.id)
      from public.monthly_revenue_entries as revenue_entry
      where revenue_entry.business_id = p_business_id
        and revenue_entry.monthly_period_id = p_monthly_period_id
    ), '[]'::jsonb),
    'expense_entries', coalesce((
      select jsonb_agg(to_jsonb(expense_entry) order by expense_entry.id)
      from public.monthly_expense_entries as expense_entry
      where expense_entry.business_id = p_business_id
        and expense_entry.monthly_period_id = p_monthly_period_id
    ), '[]'::jsonb)
  )
  from public.monthly_periods as period
  where period.id = p_monthly_period_id
    and period.business_id = p_business_id;
$$;

revoke all on function private.monthly_actual_snapshot(uuid, uuid) from public;
revoke all on function private.monthly_actual_snapshot(uuid, uuid) from anon;
revoke all on function private.monthly_actual_snapshot(uuid, uuid) from authenticated;
revoke all on function private.monthly_actual_snapshot(uuid, uuid) from service_role;

create or replace function public.correct_historical_monthly_actuals(
  target_business_id uuid,
  target_month_start date,
  target_new_customers integer,
  target_total_paying_customers integer,
  target_unallocated_gross numeric,
  target_unallocated_refunds numeric,
  target_adjustment_note text,
  target_revenue_entries jsonb,
  target_expense_entries jsonb,
  target_correction_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_timezone text;
  business_current_month date;
  period_id uuid;
  before_snapshot jsonb;
  after_snapshot jsonb;
  saved_period_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to correct historical actuals.';
  end if;

  if not (select private.can_manage_business(target_business_id)) then
    raise insufficient_privilege using message = 'Not allowed to correct historical actuals for this business.';
  end if;

  if target_correction_reason is null
     or char_length(btrim(target_correction_reason)) not between 1 and 500 then
    raise invalid_parameter_value using message = 'A correction reason between 1 and 500 characters is required.';
  end if;

  if target_month_start is null
     or target_month_start <> date_trunc('month', target_month_start)::date then
    raise invalid_parameter_value using message = 'month_start must be the first day of a calendar month.';
  end if;

  select business.timezone
  into business_timezone
  from public.businesses as business
  where business.id = target_business_id;

  if not found then
    raise invalid_parameter_value using message = 'Business does not exist.';
  end if;

  business_current_month := date_trunc(
    'month',
    now() at time zone business_timezone
  )::date;

  if target_month_start >= business_current_month then
    raise invalid_parameter_value using message = 'Historical correction is only valid for months before the business current month.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'historical-monthly-correction:' || target_business_id::text || ':' || target_month_start::text,
      0
    )
  );

  select period.id
  into period_id
  from public.monthly_periods as period
  where period.business_id = target_business_id
    and period.month_start = target_month_start;

  if not found then
    raise invalid_parameter_value using message = 'Historical correction requires an existing monthly period. Create a missing historical month through the normal backfill flow first.';
  end if;

  before_snapshot := private.monthly_actual_snapshot(target_business_id, period_id);

  saved_period_id := private.save_monthly_actuals_preserve_missing(
    target_business_id,
    target_month_start,
    target_new_customers,
    target_total_paying_customers,
    target_unallocated_gross,
    target_unallocated_refunds,
    target_adjustment_note,
    target_revenue_entries,
    target_expense_entries
  );

  after_snapshot := private.monthly_actual_snapshot(target_business_id, saved_period_id);

  insert into public.monthly_historical_corrections (
    business_id,
    monthly_period_id,
    month_start,
    reason,
    before_snapshot,
    after_snapshot,
    created_by_user_id
  ) values (
    target_business_id,
    saved_period_id,
    target_month_start,
    btrim(target_correction_reason),
    before_snapshot,
    after_snapshot,
    (select auth.uid())
  );

  return saved_period_id;
end;
$$;

revoke all on function public.correct_historical_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb, text) from public;
revoke all on function public.correct_historical_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb, text) from anon;
revoke all on function public.correct_historical_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb, text) from authenticated;
grant execute on function public.correct_historical_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.correct_historical_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb, text) to service_role;

comment on table public.customer_economics_manual_overrides is
  'Immutable versioned exception resolutions. Each version redistributes exactly one existing authoritative cost pool; it never creates an expense.';
comment on table public.customer_economics_legacy_reconciliations is
  'Audit mapping that links preserved pre-automatic manual allocations to one real authoritative cost pool through a validated manual override.';
comment on table public.monthly_historical_corrections is
  'Immutable before/after audit records for explicit edits to existing historical monthly actuals.';
comment on view public.customer_economics_review_exceptions is
  'Founder-facing unresolved Customer Economics review queue. Clean businesses return no rows; only safe cost-pool exceptions advertise manual override capability.';
comment on function public.correct_historical_monthly_actuals(uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb, text) is
  'Owner/admin-only explicit historical correction path. Normal monthly saves cannot alter an existing historical period; every correction captures before/after snapshots and a reason.';
