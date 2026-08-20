create table public.funnels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  funnel_type text not null,
  is_active boolean not null default true,
  creation_request_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funnels_name_check
    check (name = btrim(name) and char_length(name) between 1 and 120),
  constraint funnels_type_check
    check (funnel_type in ('webinar', 'lead_gen', 'low_ticket', 'organic', 'referral', 'event')),
  constraint funnels_business_creation_request_unique
    unique (business_id, creation_request_id)
);

create index funnels_business_id_created_at_idx
  on public.funnels (business_id, created_at desc);

alter table public.funnels enable row level security;

revoke all on public.funnels from anon;
revoke all on public.funnels from authenticated;

grant select, insert, update on public.funnels to authenticated;
grant all on public.funnels to service_role;

create policy funnels_select
on public.funnels for select
to authenticated
using ((select private.can_read_business(business_id)));

create policy funnels_insert
on public.funnels for insert
to authenticated
with check ((select private.can_manage_business(business_id)));

create policy funnels_update
on public.funnels for update
to authenticated
using ((select private.can_manage_business(business_id)))
with check ((select private.can_manage_business(business_id)));

create or replace function private.protect_funnel_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.creation_request_id is distinct from new.creation_request_id then
    raise exception 'funnel creation request id is immutable'
      using errcode = '42501';
  end if;

  if old.business_id is distinct from new.business_id then
    raise exception 'funnel business id is immutable'
      using errcode = '42501';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.protect_funnel_identity() from public;
revoke all on function private.protect_funnel_identity() from anon;
revoke all on function private.protect_funnel_identity() from authenticated;

create trigger protect_funnel_identity
  before update on public.funnels
  for each row execute function private.protect_funnel_identity();
