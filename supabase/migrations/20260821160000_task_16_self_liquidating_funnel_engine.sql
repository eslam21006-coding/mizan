alter table public.revenue_streams
  drop constraint if exists revenue_streams_stream_type_check;

alter table public.revenue_streams
  add constraint revenue_streams_stream_type_check
  check (stream_type in ('front_end', 'backend', 'other'));

alter table public.monthly_revenue_entries
  drop constraint if exists monthly_revenue_entries_stream_type_snapshot_check;

alter table public.monthly_revenue_entries
  add constraint monthly_revenue_entries_stream_type_snapshot_check
  check (stream_type_snapshot in ('front_end', 'backend', 'other'));

alter table public.monthly_expense_entries
  add constraint monthly_expense_entries_business_id_id_unique
  unique (business_id, id);

create table public.monthly_front_end_expense_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  monthly_period_id uuid not null,
  monthly_expense_entry_id uuid not null,
  expense_item_id uuid not null,
  expense_name_snapshot text not null,
  cost_behavior_snapshot text not null
    check (cost_behavior_snapshot in ('per_customer', 'percentage_revenue')),
  allocated_amount numeric(24,8) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_front_end_expense_allocations_entry_unique
    unique (monthly_expense_entry_id),
  constraint monthly_front_end_expense_allocations_amount_check
    check (allocated_amount >= 0),
  constraint monthly_front_end_allocations_period_business_fk
    foreign key (business_id, monthly_period_id)
    references public.monthly_periods(business_id, id)
    on delete cascade,
  constraint monthly_front_end_allocations_expense_entry_business_fk
    foreign key (business_id, monthly_expense_entry_id)
    references public.monthly_expense_entries(business_id, id)
    on delete cascade,
  constraint monthly_front_end_allocations_expense_business_fk
    foreign key (business_id, expense_item_id)
    references public.expense_items(business_id, id)
    on delete restrict
);

create index monthly_front_end_allocations_business_period_idx
  on public.monthly_front_end_expense_allocations (business_id, monthly_period_id);

alter table public.monthly_front_end_expense_allocations enable row level security;

revoke all on public.monthly_front_end_expense_allocations from anon;
revoke all on public.monthly_front_end_expense_allocations from authenticated;
grant select on public.monthly_front_end_expense_allocations to authenticated;
grant all on public.monthly_front_end_expense_allocations to service_role;

create policy monthly_front_end_expense_allocations_select
on public.monthly_front_end_expense_allocations for select
to authenticated
using ((select private.can_read_business(business_id)));

create or replace function private.protect_front_end_expense_allocation_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.id is distinct from new.id
     or old.business_id is distinct from new.business_id
     or old.monthly_period_id is distinct from new.monthly_period_id
     or old.monthly_expense_entry_id is distinct from new.monthly_expense_entry_id
     or old.expense_item_id is distinct from new.expense_item_id
     or old.expense_name_snapshot is distinct from new.expense_name_snapshot
     or old.cost_behavior_snapshot is distinct from new.cost_behavior_snapshot
     or old.created_at is distinct from new.created_at then
    raise exception 'front-end expense allocation identity is immutable'
      using errcode = '42501';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.protect_front_end_expense_allocation_identity() from public;
revoke all on function private.protect_front_end_expense_allocation_identity() from anon;
revoke all on function private.protect_front_end_expense_allocation_identity() from authenticated;

create trigger protect_front_end_expense_allocation_identity
  before update on public.monthly_front_end_expense_allocations
  for each row execute function private.protect_front_end_expense_allocation_identity();

create or replace function public.save_front_end_expense_allocations(
  target_business_id uuid,
  target_month_start date,
  target_allocations jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  period_id uuid;
  period_new_customers integer;
  period_paying_customers integer;
  period_unallocated_gross numeric;
  period_unallocated_refunds numeric;
  business_net_cash numeric;
  revenue_incomplete boolean;
  allocation_entry jsonb;
  target_expense_entry_id uuid;
  allocation_amount numeric;
  expense_item_id_value uuid;
  expense_name_value text;
  behavior_value text;
  input_value_value numeric;
  count_basis_value text;
  expense_amount numeric;
begin
  if not (select private.can_manage_business(target_business_id)) then
    raise exception 'not allowed to manage front-end allocations for this business'
      using errcode = '42501';
  end if;

  if target_month_start is null
     or target_month_start <> date_trunc('month', target_month_start)::date then
    raise exception 'month_start must be the first day of a calendar month'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(target_allocations, '[]'::jsonb)) <> 'array' then
    raise exception 'front-end allocation payload must be an array'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(target_allocations, '[]'::jsonb)) item
    group by item->>'monthly_expense_entry_id'
    having count(*) > 1
  ) then
    raise exception 'duplicate monthly expense entry in front-end allocation payload'
      using errcode = '22023';
  end if;

  select
    mp.id,
    mp.new_customers,
    mp.total_paying_customers,
    mp.unallocated_gross_cash_collected,
    mp.unallocated_refunds
  into
    period_id,
    period_new_customers,
    period_paying_customers,
    period_unallocated_gross,
    period_unallocated_refunds
  from public.monthly_periods mp
  where mp.business_id = target_business_id
    and mp.month_start = target_month_start;

  if not found then
    raise exception 'monthly business actuals must exist before front-end allocations'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.monthly_revenue_entries mre
    where mre.business_id = target_business_id
      and mre.monthly_period_id = period_id
      and (mre.gross_cash_collected is null or mre.refunds is null)
  ) into revenue_incomplete;

  if revenue_incomplete then
    business_net_cash := null;
  else
    select
      period_unallocated_gross
      - period_unallocated_refunds
      + coalesce(sum(mre.gross_cash_collected - mre.refunds), 0)
    into business_net_cash
    from public.monthly_revenue_entries mre
    where mre.business_id = target_business_id
      and mre.monthly_period_id = period_id;
  end if;

  for allocation_entry in
    select value
    from jsonb_array_elements(coalesce(target_allocations, '[]'::jsonb))
  loop
    target_expense_entry_id := nullif(btrim(allocation_entry->>'monthly_expense_entry_id'), '')::uuid;

    if target_expense_entry_id is null then
      raise exception 'monthly expense entry id is required'
        using errcode = '22023';
    end if;

    allocation_amount := case
      when nullif(btrim(allocation_entry->>'allocated_amount'), '') is null then null
      else (allocation_entry->>'allocated_amount')::numeric
    end;

    select
      mee.expense_item_id,
      mee.expense_name_snapshot,
      mee.cost_behavior_snapshot,
      mee.input_value,
      mee.customer_count_basis
    into
      expense_item_id_value,
      expense_name_value,
      behavior_value,
      input_value_value,
      count_basis_value
    from public.monthly_expense_entries mee
    where mee.id = target_expense_entry_id
      and mee.business_id = target_business_id
      and mee.monthly_period_id = period_id;

    if not found then
      raise exception 'monthly expense entry does not belong to this business month'
        using errcode = '42501';
    end if;

    if behavior_value not in ('per_customer', 'percentage_revenue') then
      raise exception 'only variable expenses can be allocated to Front-End'
        using errcode = '22023';
    end if;

    if allocation_amount is null then
      delete from public.monthly_front_end_expense_allocations existing
      where existing.business_id = target_business_id
        and existing.monthly_expense_entry_id = target_expense_entry_id;
      continue;
    end if;

    if allocation_amount < 0 then
      raise exception 'front-end allocation cannot be negative'
        using errcode = '22023';
    end if;

    if input_value_value is null then
      raise exception 'expense input is unavailable, so front-end allocation cannot be validated'
        using errcode = '22023';
    end if;

    if behavior_value = 'per_customer' then
      if count_basis_value = 'new_customers' then
        if period_new_customers is null then
          raise exception 'new customer count is unavailable for this expense allocation'
            using errcode = '22023';
        end if;
        expense_amount := input_value_value * period_new_customers;
      elsif count_basis_value = 'total_paying_customers' then
        if period_paying_customers is null then
          raise exception 'paying customer count is unavailable for this expense allocation'
            using errcode = '22023';
        end if;
        expense_amount := input_value_value * period_paying_customers;
      else
        raise exception 'per-customer expense count basis is invalid'
          using errcode = '22023';
      end if;
    else
      if business_net_cash is null then
        raise exception 'business net cash is unavailable for percentage expense allocation'
          using errcode = '22023';
      end if;
      expense_amount := input_value_value * greatest(business_net_cash, 0);
    end if;

    if allocation_amount > expense_amount then
      raise exception 'front-end allocation cannot exceed calculated variable expense amount'
        using errcode = '22023';
    end if;

    insert into public.monthly_front_end_expense_allocations (
      business_id,
      monthly_period_id,
      monthly_expense_entry_id,
      expense_item_id,
      expense_name_snapshot,
      cost_behavior_snapshot,
      allocated_amount
    ) values (
      target_business_id,
      period_id,
      target_expense_entry_id,
      expense_item_id_value,
      expense_name_value,
      behavior_value,
      allocation_amount
    )
    on conflict (monthly_expense_entry_id) do update set
      allocated_amount = excluded.allocated_amount,
      updated_at = now();
  end loop;

  return period_id;
end;
$$;

revoke all on function public.save_front_end_expense_allocations(uuid, date, jsonb) from public;
revoke all on function public.save_front_end_expense_allocations(uuid, date, jsonb) from anon;
revoke all on function public.save_front_end_expense_allocations(uuid, date, jsonb) from authenticated;
grant execute on function public.save_front_end_expense_allocations(uuid, date, jsonb) to authenticated;
