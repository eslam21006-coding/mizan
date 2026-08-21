alter table public.funnels
  add constraint funnels_business_id_id_unique unique (business_id, id);

create table public.funnel_monthly_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  month_start date not null,
  business_ad_spend numeric(24,8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funnel_monthly_periods_business_month_unique
    unique (business_id, month_start),
  constraint funnel_monthly_periods_business_id_id_unique
    unique (business_id, id),
  constraint funnel_monthly_periods_month_start_check
    check (month_start = date_trunc('month', month_start)::date),
  constraint funnel_monthly_periods_business_ad_spend_check
    check (business_ad_spend is null or business_ad_spend >= 0)
);

create index funnel_monthly_periods_business_month_idx
  on public.funnel_monthly_periods (business_id, month_start desc);

create table public.funnel_monthly_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  funnel_monthly_period_id uuid not null,
  funnel_id uuid not null,
  funnel_name_snapshot text not null,
  funnel_type_snapshot text not null
    check (funnel_type_snapshot in ('webinar', 'lead_gen', 'low_ticket', 'organic', 'referral', 'event')),
  ad_spend numeric(24,8),
  leads integer,
  booked_calls integer,
  showed_calls integer,
  qualified_calls integer,
  sales integer,
  new_customers integer,
  cash_collected numeric(24,8),
  attributed_revenue numeric(24,8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funnel_monthly_entries_period_funnel_unique
    unique (funnel_monthly_period_id, funnel_id),
  constraint funnel_monthly_entries_ad_spend_check
    check (ad_spend is null or ad_spend >= 0),
  constraint funnel_monthly_entries_leads_check
    check (leads is null or leads >= 0),
  constraint funnel_monthly_entries_booked_calls_check
    check (booked_calls is null or booked_calls >= 0),
  constraint funnel_monthly_entries_showed_calls_check
    check (showed_calls is null or showed_calls >= 0),
  constraint funnel_monthly_entries_qualified_calls_check
    check (qualified_calls is null or qualified_calls >= 0),
  constraint funnel_monthly_entries_sales_check
    check (sales is null or sales >= 0),
  constraint funnel_monthly_entries_new_customers_check
    check (new_customers is null or new_customers >= 0),
  constraint funnel_monthly_entries_cash_collected_check
    check (cash_collected is null or cash_collected >= 0),
  constraint funnel_monthly_entries_period_business_fk
    foreign key (business_id, funnel_monthly_period_id)
    references public.funnel_monthly_periods(business_id, id)
    on delete restrict,
  constraint funnel_monthly_entries_funnel_business_fk
    foreign key (business_id, funnel_id)
    references public.funnels(business_id, id)
    on delete restrict
);

create index funnel_monthly_entries_business_period_idx
  on public.funnel_monthly_entries (business_id, funnel_monthly_period_id);

alter table public.funnel_monthly_periods enable row level security;
alter table public.funnel_monthly_entries enable row level security;

revoke all on public.funnel_monthly_periods from anon;
revoke all on public.funnel_monthly_periods from authenticated;
revoke all on public.funnel_monthly_entries from anon;
revoke all on public.funnel_monthly_entries from authenticated;

grant select on public.funnel_monthly_periods to authenticated;
grant select on public.funnel_monthly_entries to authenticated;
grant all on public.funnel_monthly_periods to service_role;
grant all on public.funnel_monthly_entries to service_role;

create policy funnel_monthly_periods_select
on public.funnel_monthly_periods for select
to authenticated
using ((select private.can_read_business(business_id)));

create policy funnel_monthly_entries_select
on public.funnel_monthly_entries for select
to authenticated
using ((select private.can_read_business(business_id)));

create or replace function private.protect_funnel_monthly_period_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.id is distinct from new.id
     or old.business_id is distinct from new.business_id
     or old.month_start is distinct from new.month_start
     or old.created_at is distinct from new.created_at then
    raise exception 'funnel monthly period identity is immutable'
      using errcode = '42501';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.protect_funnel_monthly_entry_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.id is distinct from new.id
     or old.business_id is distinct from new.business_id
     or old.funnel_monthly_period_id is distinct from new.funnel_monthly_period_id
     or old.funnel_id is distinct from new.funnel_id
     or old.funnel_name_snapshot is distinct from new.funnel_name_snapshot
     or old.funnel_type_snapshot is distinct from new.funnel_type_snapshot
     or old.created_at is distinct from new.created_at then
    raise exception 'funnel monthly entry identity is immutable'
      using errcode = '42501';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.protect_funnel_monthly_period_identity() from public;
revoke all on function private.protect_funnel_monthly_period_identity() from anon;
revoke all on function private.protect_funnel_monthly_period_identity() from authenticated;
revoke all on function private.protect_funnel_monthly_entry_identity() from public;
revoke all on function private.protect_funnel_monthly_entry_identity() from anon;
revoke all on function private.protect_funnel_monthly_entry_identity() from authenticated;

create trigger protect_funnel_monthly_period_identity
  before update on public.funnel_monthly_periods
  for each row execute function private.protect_funnel_monthly_period_identity();

create trigger protect_funnel_monthly_entry_identity
  before update on public.funnel_monthly_entries
  for each row execute function private.protect_funnel_monthly_entry_identity();

create or replace function public.save_funnel_monthly_actuals(
  target_business_id uuid,
  target_month_start date,
  target_business_ad_spend numeric,
  target_funnel_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  period_id uuid;
  funnel_entry jsonb;
  target_funnel_id uuid;
  stored_name text;
  stored_type text;
  funnel_active boolean;
  ad_spend_value numeric;
  leads_value integer;
  booked_value integer;
  showed_value integer;
  qualified_value integer;
  sales_value integer;
  new_customers_value integer;
  cash_collected_value numeric;
  attributed_revenue_value numeric;
begin
  if not (select private.can_manage_business(target_business_id)) then
    raise exception 'not allowed to manage funnel monthly actuals for this business'
      using errcode = '42501';
  end if;

  if target_month_start is null
     or target_month_start <> date_trunc('month', target_month_start)::date then
    raise exception 'month_start must be the first day of a calendar month'
      using errcode = '22023';
  end if;

  if target_business_ad_spend is not null and target_business_ad_spend < 0 then
    raise exception 'business ad spend must be non-negative'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(target_funnel_entries, '[]'::jsonb)) <> 'array' then
    raise exception 'funnel monthly entry payload must be an array'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(target_funnel_entries, '[]'::jsonb)) item
    group by item->>'funnel_id'
    having count(*) > 1
  ) then
    raise exception 'duplicate funnel in monthly payload' using errcode = '22023';
  end if;

  insert into public.funnel_monthly_periods (
    business_id,
    month_start,
    business_ad_spend
  ) values (
    target_business_id,
    target_month_start,
    target_business_ad_spend
  )
  on conflict (business_id, month_start) do update set
    business_ad_spend = excluded.business_ad_spend,
    updated_at = now()
  returning id into period_id;

  for funnel_entry in
    select value
    from jsonb_array_elements(coalesce(target_funnel_entries, '[]'::jsonb))
  loop
    target_funnel_id := nullif(btrim(funnel_entry->>'funnel_id'), '')::uuid;
    if target_funnel_id is null then
      raise exception 'funnel id is required' using errcode = '22023';
    end if;

    ad_spend_value := case
      when nullif(btrim(funnel_entry->>'ad_spend'), '') is null then null
      else (funnel_entry->>'ad_spend')::numeric
    end;
    leads_value := case
      when nullif(btrim(funnel_entry->>'leads'), '') is null then null
      else (funnel_entry->>'leads')::integer
    end;
    booked_value := case
      when nullif(btrim(funnel_entry->>'booked_calls'), '') is null then null
      else (funnel_entry->>'booked_calls')::integer
    end;
    showed_value := case
      when nullif(btrim(funnel_entry->>'showed_calls'), '') is null then null
      else (funnel_entry->>'showed_calls')::integer
    end;
    qualified_value := case
      when nullif(btrim(funnel_entry->>'qualified_calls'), '') is null then null
      else (funnel_entry->>'qualified_calls')::integer
    end;
    sales_value := case
      when nullif(btrim(funnel_entry->>'sales'), '') is null then null
      else (funnel_entry->>'sales')::integer
    end;
    new_customers_value := case
      when nullif(btrim(funnel_entry->>'new_customers'), '') is null then null
      else (funnel_entry->>'new_customers')::integer
    end;
    cash_collected_value := case
      when nullif(btrim(funnel_entry->>'cash_collected'), '') is null then null
      else (funnel_entry->>'cash_collected')::numeric
    end;
    attributed_revenue_value := case
      when nullif(btrim(funnel_entry->>'attributed_revenue'), '') is null then null
      else (funnel_entry->>'attributed_revenue')::numeric
    end;

    if ad_spend_value is not null and ad_spend_value < 0 then
      raise exception 'funnel ad spend must be non-negative' using errcode = '22023';
    end if;
    if leads_value is not null and leads_value < 0 then
      raise exception 'leads must be non-negative' using errcode = '22023';
    end if;
    if booked_value is not null and booked_value < 0 then
      raise exception 'booked calls must be non-negative' using errcode = '22023';
    end if;
    if showed_value is not null and showed_value < 0 then
      raise exception 'showed calls must be non-negative' using errcode = '22023';
    end if;
    if qualified_value is not null and qualified_value < 0 then
      raise exception 'qualified calls must be non-negative' using errcode = '22023';
    end if;
    if sales_value is not null and sales_value < 0 then
      raise exception 'sales must be non-negative' using errcode = '22023';
    end if;
    if new_customers_value is not null and new_customers_value < 0 then
      raise exception 'new customers must be non-negative' using errcode = '22023';
    end if;
    if cash_collected_value is not null and cash_collected_value < 0 then
      raise exception 'cash collected must be non-negative' using errcode = '22023';
    end if;

    select
      existing.funnel_name_snapshot,
      existing.funnel_type_snapshot
    into stored_name, stored_type
    from public.funnel_monthly_entries existing
    where existing.funnel_monthly_period_id = period_id
      and existing.funnel_id = target_funnel_id;

    if not found then
      select f.name, f.funnel_type, f.is_active
        into stored_name, stored_type, funnel_active
      from public.funnels f
      where f.id = target_funnel_id
        and f.business_id = target_business_id;

      if not found then
        raise exception 'funnel does not belong to business' using errcode = '42501';
      end if;

      if not funnel_active then
        raise exception 'inactive funnel cannot be added to a new monthly period'
          using errcode = '22023';
      end if;
    else
      if not exists (
        select 1
        from public.funnels f
        where f.id = target_funnel_id
          and f.business_id = target_business_id
      ) then
        raise exception 'funnel does not belong to business' using errcode = '42501';
      end if;
    end if;

    insert into public.funnel_monthly_entries (
      business_id,
      funnel_monthly_period_id,
      funnel_id,
      funnel_name_snapshot,
      funnel_type_snapshot,
      ad_spend,
      leads,
      booked_calls,
      showed_calls,
      qualified_calls,
      sales,
      new_customers,
      cash_collected,
      attributed_revenue
    ) values (
      target_business_id,
      period_id,
      target_funnel_id,
      stored_name,
      stored_type,
      ad_spend_value,
      leads_value,
      booked_value,
      showed_value,
      qualified_value,
      sales_value,
      new_customers_value,
      cash_collected_value,
      attributed_revenue_value
    )
    on conflict (funnel_monthly_period_id, funnel_id) do update set
      ad_spend = excluded.ad_spend,
      leads = excluded.leads,
      booked_calls = excluded.booked_calls,
      showed_calls = excluded.showed_calls,
      qualified_calls = excluded.qualified_calls,
      sales = excluded.sales,
      new_customers = excluded.new_customers,
      cash_collected = excluded.cash_collected,
      attributed_revenue = excluded.attributed_revenue,
      updated_at = now();
  end loop;

  return period_id;
end;
$$;

revoke all on function public.save_funnel_monthly_actuals(uuid, date, numeric, jsonb) from public;
revoke all on function public.save_funnel_monthly_actuals(uuid, date, numeric, jsonb) from anon;
grant execute on function public.save_funnel_monthly_actuals(uuid, date, numeric, jsonb) to authenticated;
grant execute on function public.save_funnel_monthly_actuals(uuid, date, numeric, jsonb) to service_role;
