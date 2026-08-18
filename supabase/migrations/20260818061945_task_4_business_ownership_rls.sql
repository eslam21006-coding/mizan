create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select u.raw_app_meta_data ->> 'role' = 'admin'
      from auth.users as u
      where u.id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_admin() from anon;
revoke all on function private.is_admin() from authenticated;
grant execute on function private.is_admin() to authenticated;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  base_currency text not null check (
    base_currency in ('USD', 'AED', 'SAR', 'EGP', 'KWD', 'QAR', 'JOD', 'EUR')
  ),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null check (membership_role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create unique index business_memberships_one_owner_idx
  on public.business_memberships (business_id)
  where membership_role = 'owner';

create index business_memberships_user_id_idx
  on public.business_memberships (user_id, business_id);

create index businesses_owner_user_id_idx
  on public.businesses (owner_user_id);

alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;

revoke all on public.businesses from anon;
revoke all on public.business_memberships from anon;

grant select, insert, update, delete on public.businesses to authenticated;
grant select, insert, update, delete on public.business_memberships to authenticated;
grant all on public.businesses to service_role;
grant all on public.business_memberships to service_role;

create or replace function private.user_owns_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses as business
    where business.id = target_business_id
      and business.owner_user_id = (select auth.uid())
  );
$$;

revoke all on function private.user_owns_business(uuid) from public;
revoke all on function private.user_owns_business(uuid) from anon;
revoke all on function private.user_owns_business(uuid) from authenticated;
grant execute on function private.user_owns_business(uuid) to authenticated;

create policy businesses_select
on public.businesses for select
to authenticated
using (
  (select private.is_admin())
  or owner_user_id = (select auth.uid())
  or id in (
    select membership.business_id
    from public.business_memberships as membership
    where membership.user_id = (select auth.uid())
  )
);

create policy businesses_insert
on public.businesses for insert
to authenticated
with check (
  (select private.is_admin())
  or ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
);

create policy businesses_update
on public.businesses for update
to authenticated
using (
  (select private.is_admin())
  or owner_user_id = (select auth.uid())
)
with check (
  (select private.is_admin())
  or owner_user_id = (select auth.uid())
);

create policy businesses_delete
on public.businesses for delete
to authenticated
using (
  (select private.is_admin())
  or owner_user_id = (select auth.uid())
);

create policy business_memberships_select
on public.business_memberships for select
to authenticated
using (
  (select private.is_admin())
  or user_id = (select auth.uid())
);

create policy business_memberships_insert
on public.business_memberships for insert
to authenticated
with check (
  (select private.is_admin())
  or (
    user_id = (select auth.uid())
    and membership_role = 'owner'
    and (select private.user_owns_business(business_id))
  )
);

create policy business_memberships_update
on public.business_memberships for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy business_memberships_delete
on public.business_memberships for delete
to authenticated
using ((select private.is_admin()));

create or replace function private.sync_business_owner_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.owner_user_id is distinct from new.owner_user_id then
    delete from public.business_memberships
    where business_id = new.id
      and user_id = old.owner_user_id
      and membership_role = 'owner';
  end if;

  insert into public.business_memberships (business_id, user_id, membership_role)
  values (new.id, new.owner_user_id, 'owner')
  on conflict (business_id, user_id)
  do update set membership_role = excluded.membership_role;

  return new;
end;
$$;

revoke all on function private.sync_business_owner_membership() from public;

create trigger sync_business_owner_membership
  after insert or update of owner_user_id on public.businesses
  for each row execute function private.sync_business_owner_membership();
