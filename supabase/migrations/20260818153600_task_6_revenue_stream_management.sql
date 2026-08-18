create or replace function private.can_read_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_admin())
    or exists (
      select 1
      from public.businesses as business
      where business.id = target_business_id
        and business.owner_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.business_memberships as membership
      where membership.business_id = target_business_id
        and membership.user_id = (select auth.uid())
    );
$$;

revoke all on function private.can_read_business(uuid) from public;
revoke all on function private.can_read_business(uuid) from anon;
revoke all on function private.can_read_business(uuid) from authenticated;
grant execute on function private.can_read_business(uuid) to authenticated;

create or replace function private.can_manage_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_admin())
    or exists (
      select 1
      from public.businesses as business
      where business.id = target_business_id
        and business.owner_user_id = (select auth.uid())
    );
$$;

revoke all on function private.can_manage_business(uuid) from public;
revoke all on function private.can_manage_business(uuid) from anon;
revoke all on function private.can_manage_business(uuid) from authenticated;
grant execute on function private.can_manage_business(uuid) to authenticated;

create table public.revenue_streams (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  stream_type text not null check (stream_type in ('front_end', 'backend')),
  is_active boolean not null default true,
  creation_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint revenue_streams_business_creation_request_unique
    unique (business_id, creation_request_id)
);

create index revenue_streams_business_id_idx
  on public.revenue_streams (business_id, created_at desc);

alter table public.revenue_streams enable row level security;

revoke all on public.revenue_streams from anon;
revoke all on public.revenue_streams from authenticated;

grant select, insert, update on public.revenue_streams to authenticated;
grant all on public.revenue_streams to service_role;

create policy revenue_streams_select
on public.revenue_streams for select
to authenticated
using ((select private.can_read_business(business_id)));

create policy revenue_streams_insert
on public.revenue_streams for insert
to authenticated
with check ((select private.can_manage_business(business_id)));

create policy revenue_streams_update
on public.revenue_streams for update
to authenticated
using ((select private.can_manage_business(business_id)))
with check ((select private.can_manage_business(business_id)));

create or replace function private.prevent_revenue_stream_creation_request_id_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.creation_request_id is distinct from new.creation_request_id then
    raise exception 'revenue stream creation request id is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_revenue_stream_creation_request_id_update() from public;
revoke all on function private.prevent_revenue_stream_creation_request_id_update() from anon;
revoke all on function private.prevent_revenue_stream_creation_request_id_update() from authenticated;

create trigger prevent_revenue_stream_creation_request_id_update
  before update of creation_request_id on public.revenue_streams
  for each row execute function private.prevent_revenue_stream_creation_request_id_update();
