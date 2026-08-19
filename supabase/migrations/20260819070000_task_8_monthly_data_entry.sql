alter table public.revenue_streams
  add constraint revenue_streams_business_id_id_unique unique (business_id, id);

alter table public.expense_items
  add constraint expense_items_business_id_id_unique unique (business_id, id);

create table public.monthly_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  month_start date not null,
  new_customers integer,
  total_paying_customers integer,
  unallocated_gross_cash_collected numeric(24,8) not null default 0,
  unallocated_refunds numeric(24,8) not null default 0,
  adjustment_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_periods_business_month_unique unique (business_id, month_start),
  constraint monthly_periods_business_id_id_unique unique (business_id, id),
  constraint monthly_periods_month_start_check check (
    month_start = date_trunc('month', month_start)::date
  ),
  constraint monthly_periods_new_customers_check check (
    new_customers is null or new_customers >= 0
  ),
  constraint monthly_periods_total_paying_customers_check check (
    total_paying_customers is null or total_paying_customers >= 0
  ),
  constraint monthly_periods_customer_counts_check check (
    new_customers is null
    or total_paying_customers is null
    or new_customers <= total_paying_customers
  ),
  constraint monthly_periods_unallocated_gross_check check (
    unallocated_gross_cash_collected >= 0
  ),
  constraint monthly_periods_unallocated_refunds_check check (
    unallocated_refunds >= 0
  ),
  constraint monthly_periods_adjustment_note_check check (
    adjustment_note is null or char_length(adjustment_note) <= 500
  )
);

create index monthly_periods_business_month_idx
  on public.monthly_periods (business_id, month_start desc);

create table public.monthly_revenue_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  monthly_period_id uuid not null,
  revenue_stream_id uuid not null,
  stream_name_snapshot text not null,
  stream_type_snapshot text not null
    check (stream_type_snapshot in ('front_end', 'backend')),
  gross_cash_collected numeric(24,8),
  refunds numeric(24,8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_revenue_entries_period_stream_unique
    unique (monthly_period_id, revenue_stream_id),
  constraint monthly_revenue_entries_gross_check
    check (gross_cash_collected is null or gross_cash_collected >= 0),
  constraint monthly_revenue_entries_refunds_check
    check (refunds is null or refunds >= 0),
  constraint monthly_revenue_entries_period_business_fk
    foreign key (business_id, monthly_period_id)
    references public.monthly_periods(business_id, id)
    on delete cascade,
  constraint monthly_revenue_entries_stream_business_fk
    foreign key (business_id, revenue_stream_id)
    references public.revenue_streams(business_id, id)
    on delete cascade
);

create index monthly_revenue_entries_business_period_idx
  on public.monthly_revenue_entries (business_id, monthly_period_id);

create table public.monthly_expense_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  monthly_period_id uuid not null,
  expense_item_id uuid not null,
  expense_name_snapshot text not null,
  category_snapshot text not null
    check (category_snapshot in ('acquisition', 'fulfillment', 'overhead', 'financial')),
  cost_behavior_snapshot text not null
    check (cost_behavior_snapshot in ('fixed_monthly', 'per_customer', 'percentage_revenue')),
  input_value numeric(24,8),
  customer_count_basis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_expense_entries_period_expense_unique
    unique (monthly_period_id, expense_item_id),
  constraint monthly_expense_entries_value_check
    check (input_value is null or input_value >= 0),
  constraint monthly_expense_entries_basis_check check (
    (
      cost_behavior_snapshot = 'per_customer'
      and customer_count_basis in ('new_customers', 'total_paying_customers')
    )
    or (
      cost_behavior_snapshot <> 'per_customer'
      and customer_count_basis is null
    )
  ),
  constraint monthly_expense_entries_period_business_fk
    foreign key (business_id, monthly_period_id)
    references public.monthly_periods(business_id, id)
    on delete cascade,
  constraint monthly_expense_entries_expense_business_fk
    foreign key (business_id, expense_item_id)
    references public.expense_items(business_id, id)
    on delete cascade
);

create index monthly_expense_entries_business_period_idx
  on public.monthly_expense_entries (business_id, monthly_period_id);

alter table public.monthly_periods enable row level security;
alter table public.monthly_revenue_entries enable row level security;
alter table public.monthly_expense_entries enable row level security;

revoke all on public.monthly_periods from anon;
revoke all on public.monthly_periods from authenticated;
revoke all on public.monthly_revenue_entries from anon;
revoke all on public.monthly_revenue_entries from authenticated;
revoke all on public.monthly_expense_entries from anon;
revoke all on public.monthly_expense_entries from authenticated;

grant select on public.monthly_periods to authenticated;
grant select on public.monthly_revenue_entries to authenticated;
grant select on public.monthly_expense_entries to authenticated;

grant all on public.monthly_periods to service_role;
grant all on public.monthly_revenue_entries to service_role;
grant all on public.monthly_expense_entries to service_role;

create policy monthly_periods_select
on public.monthly_periods for select
to authenticated
using ((select private.can_read_business(business_id)));

create policy monthly_revenue_entries_select
on public.monthly_revenue_entries for select
to authenticated
using ((select private.can_read_business(business_id)));

create policy monthly_expense_entries_select
on public.monthly_expense_entries for select
to authenticated
using ((select private.can_read_business(business_id)));

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
  period_id uuid;
  revenue_entry jsonb;
  expense_entry jsonb;
  stream_id uuid;
  stream_name text;
  stream_type_value text;
  stream_active boolean;
  gross_value numeric;
  refund_value numeric;
  expense_id uuid;
  expense_name text;
  expense_category text;
  expense_behavior text;
  expense_active boolean;
  stored_behavior text;
  stored_name text;
  stored_category text;
  display_value numeric;
  stored_value numeric;
  count_basis text;
begin
  if not (select private.can_manage_business(target_business_id)) then
    raise exception 'not allowed to manage monthly actuals for this business'
      using errcode = '42501';
  end if;

  if target_month_start is null
     or target_month_start <> date_trunc('month', target_month_start)::date then
    raise exception 'month_start must be the first day of a calendar month'
      using errcode = '22023';
  end if;

  if target_new_customers is not null and target_new_customers < 0 then
    raise exception 'new_customers must be non-negative' using errcode = '22023';
  end if;

  if target_total_paying_customers is not null and target_total_paying_customers < 0 then
    raise exception 'total_paying_customers must be non-negative' using errcode = '22023';
  end if;

  if target_new_customers is not null
     and target_total_paying_customers is not null
     and target_new_customers > target_total_paying_customers then
    raise exception 'new_customers cannot exceed total_paying_customers'
      using errcode = '22023';
  end if;

  if coalesce(target_unallocated_gross, 0) < 0
     or coalesce(target_unallocated_refunds, 0) < 0 then
    raise exception 'manual revenue and refund amounts must be non-negative'
      using errcode = '22023';
  end if;

  if target_adjustment_note is not null and char_length(target_adjustment_note) > 500 then
    raise exception 'adjustment note is too long' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(target_revenue_entries, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(target_expense_entries, '[]'::jsonb)) <> 'array' then
    raise exception 'monthly entry payloads must be arrays' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(target_revenue_entries, '[]'::jsonb)) item
    group by item->>'revenue_stream_id'
    having count(*) > 1
  ) then
    raise exception 'duplicate revenue stream in monthly payload' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(target_expense_entries, '[]'::jsonb)) item
    group by item->>'expense_item_id'
    having count(*) > 1
  ) then
    raise exception 'duplicate expense item in monthly payload' using errcode = '22023';
  end if;

  insert into public.monthly_periods (
    business_id,
    month_start,
    new_customers,
    total_paying_customers,
    unallocated_gross_cash_collected,
    unallocated_refunds,
    adjustment_note
  ) values (
    target_business_id,
    target_month_start,
    target_new_customers,
    target_total_paying_customers,
    coalesce(target_unallocated_gross, 0),
    coalesce(target_unallocated_refunds, 0),
    nullif(btrim(target_adjustment_note), '')
  )
  on conflict (business_id, month_start) do update set
    new_customers = excluded.new_customers,
    total_paying_customers = excluded.total_paying_customers,
    unallocated_gross_cash_collected = excluded.unallocated_gross_cash_collected,
    unallocated_refunds = excluded.unallocated_refunds,
    adjustment_note = excluded.adjustment_note,
    updated_at = now()
  returning id into period_id;

  for revenue_entry in
    select value
    from jsonb_array_elements(coalesce(target_revenue_entries, '[]'::jsonb))
  loop
    stream_id := nullif(revenue_entry->>'revenue_stream_id', '')::uuid;
    gross_value := case
      when nullif(btrim(revenue_entry->>'gross_cash_collected'), '') is null then null
      else (revenue_entry->>'gross_cash_collected')::numeric
    end;
    refund_value := case
      when nullif(btrim(revenue_entry->>'refunds'), '') is null then null
      else (revenue_entry->>'refunds')::numeric
    end;

    if stream_id is null then
      raise exception 'revenue stream id is required' using errcode = '22023';
    end if;
    if gross_value is not null and gross_value < 0 then
      raise exception 'gross cash must be non-negative' using errcode = '22023';
    end if;
    if refund_value is not null and refund_value < 0 then
      raise exception 'refunds must be non-negative' using errcode = '22023';
    end if;

    select rs.name, rs.stream_type, rs.is_active
      into stream_name, stream_type_value, stream_active
    from public.revenue_streams rs
    where rs.id = stream_id and rs.business_id = target_business_id;

    if not found then
      raise exception 'revenue stream does not belong to business' using errcode = '42501';
    end if;

    if not stream_active and not exists (
      select 1
      from public.monthly_revenue_entries existing
      where existing.monthly_period_id = period_id
        and existing.revenue_stream_id = stream_id
    ) then
      raise exception 'inactive revenue stream cannot be added to a new monthly period'
        using errcode = '22023';
    end if;

    insert into public.monthly_revenue_entries (
      business_id,
      monthly_period_id,
      revenue_stream_id,
      stream_name_snapshot,
      stream_type_snapshot,
      gross_cash_collected,
      refunds
    ) values (
      target_business_id,
      period_id,
      stream_id,
      stream_name,
      stream_type_value,
      gross_value,
      refund_value
    )
    on conflict (monthly_period_id, revenue_stream_id) do update set
      gross_cash_collected = excluded.gross_cash_collected,
      refunds = excluded.refunds,
      updated_at = now();
  end loop;

  for expense_entry in
    select value
    from jsonb_array_elements(coalesce(target_expense_entries, '[]'::jsonb))
  loop
    expense_id := nullif(expense_entry->>'expense_item_id', '')::uuid;

    if expense_id is null then
      raise exception 'expense item id is required' using errcode = '22023';
    end if;

    select
      existing.expense_name_snapshot,
      existing.category_snapshot,
      existing.cost_behavior_snapshot
    into stored_name, stored_category, stored_behavior
    from public.monthly_expense_entries existing
    where existing.monthly_period_id = period_id
      and existing.expense_item_id = expense_id;

    if not found then
      select ei.name, ei.category, ei.cost_behavior, ei.is_active
        into expense_name, expense_category, expense_behavior, expense_active
      from public.expense_items ei
      where ei.id = expense_id and ei.business_id = target_business_id;

      if not found then
        raise exception 'expense item does not belong to business' using errcode = '42501';
      end if;

      if not expense_active then
        raise exception 'inactive expense item cannot be added to a new monthly period'
          using errcode = '22023';
      end if;

      stored_name := expense_name;
      stored_category := expense_category;
      stored_behavior := expense_behavior;
    else
      if not exists (
        select 1
        from public.expense_items ei
        where ei.id = expense_id and ei.business_id = target_business_id
      ) then
        raise exception 'expense item does not belong to business' using errcode = '42501';
      end if;
    end if;

    display_value := case
      when nullif(btrim(expense_entry->>'display_value'), '') is null then null
      else (expense_entry->>'display_value')::numeric
    end;

    if display_value is not null and display_value < 0 then
      raise exception 'expense values must be non-negative' using errcode = '22023';
    end if;

    count_basis := nullif(btrim(expense_entry->>'customer_count_basis'), '');

    if stored_behavior = 'per_customer' then
      if count_basis not in ('new_customers', 'total_paying_customers') then
        raise exception 'per-customer expense requires an explicit customer count basis'
          using errcode = '22023';
      end if;
    elsif count_basis is not null then
      raise exception 'customer count basis is only valid for per-customer expenses'
        using errcode = '22023';
    end if;

    stored_value := case
      when display_value is null then null
      when stored_behavior = 'percentage_revenue' then display_value / 100
      else display_value
    end;

    insert into public.monthly_expense_entries (
      business_id,
      monthly_period_id,
      expense_item_id,
      expense_name_snapshot,
      category_snapshot,
      cost_behavior_snapshot,
      input_value,
      customer_count_basis
    ) values (
      target_business_id,
      period_id,
      expense_id,
      stored_name,
      stored_category,
      stored_behavior,
      stored_value,
      count_basis
    )
    on conflict (monthly_period_id, expense_item_id) do update set
      input_value = excluded.input_value,
      customer_count_basis = excluded.customer_count_basis,
      updated_at = now();
  end loop;

  return period_id;
end;
$$;

revoke all on function public.save_monthly_actuals(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) from public;
revoke all on function public.save_monthly_actuals(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) from anon;
grant execute on function public.save_monthly_actuals(
  uuid, date, integer, integer, numeric, numeric, text, jsonb, jsonb
) to authenticated;

create or replace function public.copy_previous_month_expenses(
  target_business_id uuid,
  target_month_start date
)
returns table(previous_month_found boolean, copied_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_period_id uuid;
  target_period_id uuid;
  copied integer := 0;
begin
  if not (select private.can_manage_business(target_business_id)) then
    raise exception 'not allowed to manage monthly actuals for this business'
      using errcode = '42501';
  end if;

  if target_month_start is null
     or target_month_start <> date_trunc('month', target_month_start)::date then
    raise exception 'month_start must be the first day of a calendar month'
      using errcode = '22023';
  end if;

  select period.id into previous_period_id
  from public.monthly_periods period
  where period.business_id = target_business_id
    and period.month_start = (target_month_start - interval '1 month')::date;

  if previous_period_id is null then
    return query select false, 0;
    return;
  end if;

  insert into public.monthly_periods (business_id, month_start)
  values (target_business_id, target_month_start)
  on conflict (business_id, month_start) do update set
    updated_at = public.monthly_periods.updated_at
  returning id into target_period_id;

  with copied_rows as (
    insert into public.monthly_expense_entries (
      business_id,
      monthly_period_id,
      expense_item_id,
      expense_name_snapshot,
      category_snapshot,
      cost_behavior_snapshot,
      input_value,
      customer_count_basis
    )
    select
      target_business_id,
      target_period_id,
      previous.expense_item_id,
      current_item.name,
      current_item.category,
      current_item.cost_behavior,
      previous.input_value,
      previous.customer_count_basis
    from public.monthly_expense_entries previous
    join public.expense_items current_item
      on current_item.id = previous.expense_item_id
     and current_item.business_id = target_business_id
    where previous.monthly_period_id = previous_period_id
      and previous.business_id = target_business_id
      and previous.input_value is not null
      and current_item.is_active
      and current_item.cost_behavior = previous.cost_behavior_snapshot
    on conflict (monthly_period_id, expense_item_id) do update set
      input_value = excluded.input_value,
      customer_count_basis = excluded.customer_count_basis,
      expense_name_snapshot = excluded.expense_name_snapshot,
      category_snapshot = excluded.category_snapshot,
      updated_at = now()
    where public.monthly_expense_entries.input_value is null
      and public.monthly_expense_entries.cost_behavior_snapshot = excluded.cost_behavior_snapshot
    returning 1
  )
  select count(*)::integer into copied from copied_rows;

  return query select true, copied;
end;
$$;

revoke all on function public.copy_previous_month_expenses(uuid, date) from public;
revoke all on function public.copy_previous_month_expenses(uuid, date) from anon;
grant execute on function public.copy_previous_month_expenses(uuid, date) to authenticated;
