create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (category in ('acquisition', 'fulfillment', 'overhead', 'financial')),
  cost_behavior text not null check (cost_behavior in ('fixed_monthly', 'per_customer', 'percentage_revenue')),
  is_active boolean not null default true,
  creation_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint expense_items_business_creation_request_unique
    unique (business_id, creation_request_id)
);

create index expense_items_business_id_idx
  on public.expense_items (business_id, created_at desc);

alter table public.expense_items enable row level security;

revoke all on public.expense_items from anon;
revoke all on public.expense_items from authenticated;

grant select, insert, update on public.expense_items to authenticated;
grant all on public.expense_items to service_role;

create policy expense_items_select
on public.expense_items for select
to authenticated
using ((select private.can_read_business(business_id)));

create policy expense_items_insert
on public.expense_items for insert
to authenticated
with check ((select private.can_manage_business(business_id)));

create policy expense_items_update
on public.expense_items for update
to authenticated
using ((select private.can_manage_business(business_id)))
with check ((select private.can_manage_business(business_id)));

create or replace function private.prevent_expense_item_creation_request_id_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.creation_request_id is distinct from new.creation_request_id then
    raise exception 'expense item creation request id is immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_expense_item_creation_request_id_update() from public;
revoke all on function private.prevent_expense_item_creation_request_id_update() from anon;
revoke all on function private.prevent_expense_item_creation_request_id_update() from authenticated;

create trigger prevent_expense_item_creation_request_id_update
  before update of creation_request_id on public.expense_items
  for each row execute function private.prevent_expense_item_creation_request_id_update();
