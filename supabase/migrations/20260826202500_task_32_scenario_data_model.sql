create table public.simulator_scenarios (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  creation_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulator_scenarios_name_check
    check (name = btrim(name) and char_length(name) between 1 and 120),
  constraint simulator_scenarios_business_creation_request_unique
    unique (business_id, creation_request_id),
  constraint simulator_scenarios_business_id_id_unique
    unique (business_id, id)
);

create index simulator_scenarios_business_updated_idx
  on public.simulator_scenarios (business_id, updated_at desc, id);

create table public.simulator_scenario_overrides (
  business_id uuid not null,
  scenario_id uuid not null,
  override_key text not null,
  override_value numeric(24,8) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scenario_id, override_key),
  constraint simulator_scenario_overrides_scenario_business_fk
    foreign key (business_id, scenario_id)
    references public.simulator_scenarios(business_id, id)
    on delete cascade,
  constraint simulator_scenario_overrides_key_check
    check (
      override_key in (
        'customer_value',
        'cpl',
        'ad_spend',
        'show_rate',
        'qualification_rate',
        'close_rate',
        'fixed_costs',
        'variable_costs',
        'upsells',
        'renewals',
        'backend_revenue'
      )
    ),
  constraint simulator_scenario_overrides_non_negative_check
    check (override_value >= 0),
  constraint simulator_scenario_overrides_rate_check
    check (
      override_key not in ('show_rate', 'qualification_rate', 'close_rate')
      or override_value <= 1
    )
);

create index simulator_scenario_overrides_business_scenario_idx
  on public.simulator_scenario_overrides (business_id, scenario_id);

alter table public.simulator_scenarios enable row level security;
alter table public.simulator_scenario_overrides enable row level security;

revoke all on public.simulator_scenarios from anon;
revoke all on public.simulator_scenario_overrides from anon;
revoke all on public.simulator_scenarios from authenticated;
revoke all on public.simulator_scenario_overrides from authenticated;

grant select, insert, update, delete on public.simulator_scenarios to authenticated;
grant select, insert, update, delete on public.simulator_scenario_overrides to authenticated;
grant all on public.simulator_scenarios to service_role;
grant all on public.simulator_scenario_overrides to service_role;

create policy simulator_scenarios_select
on public.simulator_scenarios for select
to authenticated
using ((select private.can_read_business(business_id)));

create policy simulator_scenarios_insert
on public.simulator_scenarios for insert
to authenticated
with check ((select private.can_manage_business(business_id)));

create policy simulator_scenarios_update
on public.simulator_scenarios for update
to authenticated
using ((select private.can_manage_business(business_id)))
with check ((select private.can_manage_business(business_id)));

create policy simulator_scenarios_delete
on public.simulator_scenarios for delete
to authenticated
using ((select private.can_manage_business(business_id)));

create policy simulator_scenario_overrides_select
on public.simulator_scenario_overrides for select
to authenticated
using ((select private.can_read_business(business_id)));

create policy simulator_scenario_overrides_insert
on public.simulator_scenario_overrides for insert
to authenticated
with check ((select private.can_manage_business(business_id)));

create policy simulator_scenario_overrides_update
on public.simulator_scenario_overrides for update
to authenticated
using ((select private.can_manage_business(business_id)))
with check ((select private.can_manage_business(business_id)));

create policy simulator_scenario_overrides_delete
on public.simulator_scenario_overrides for delete
to authenticated
using ((select private.can_manage_business(business_id)));

create or replace function private.protect_simulator_scenario_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.id is distinct from new.id then
    raise exception 'simulator scenario id is immutable'
      using errcode = '42501';
  end if;

  if old.business_id is distinct from new.business_id then
    raise exception 'simulator scenario business id is immutable'
      using errcode = '42501';
  end if;

  if old.creation_request_id is distinct from new.creation_request_id then
    raise exception 'simulator scenario creation request id is immutable'
      using errcode = '42501';
  end if;

  if old.created_at is distinct from new.created_at then
    raise exception 'simulator scenario created_at is immutable'
      using errcode = '42501';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.protect_simulator_scenario_identity() from public;
revoke all on function private.protect_simulator_scenario_identity() from anon;
revoke all on function private.protect_simulator_scenario_identity() from authenticated;

create trigger protect_simulator_scenario_identity
  before update on public.simulator_scenarios
  for each row execute function private.protect_simulator_scenario_identity();

create or replace function private.protect_simulator_scenario_override_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.business_id is distinct from new.business_id then
    raise exception 'simulator override business id is immutable'
      using errcode = '42501';
  end if;

  if old.scenario_id is distinct from new.scenario_id then
    raise exception 'simulator override scenario id is immutable'
      using errcode = '42501';
  end if;

  if old.override_key is distinct from new.override_key then
    raise exception 'simulator override key is immutable'
      using errcode = '42501';
  end if;

  if old.created_at is distinct from new.created_at then
    raise exception 'simulator override created_at is immutable'
      using errcode = '42501';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.protect_simulator_scenario_override_identity() from public;
revoke all on function private.protect_simulator_scenario_override_identity() from anon;
revoke all on function private.protect_simulator_scenario_override_identity() from authenticated;

create trigger protect_simulator_scenario_override_identity
  before update on public.simulator_scenario_overrides
  for each row execute function private.protect_simulator_scenario_override_identity();
