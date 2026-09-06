create table public.customer_transaction_column_mappings (
  business_id uuid not null references public.businesses(id) on delete cascade,
  header_fingerprint text not null check (
    char_length(header_fingerprint) = 64
    and header_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  header_columns jsonb not null check (jsonb_typeof(header_columns) = 'array'),
  mapping jsonb not null check (jsonb_typeof(mapping) = 'object'),
  created_by_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (business_id, header_fingerprint)
);

comment on table public.customer_transaction_column_mappings is
  'Stores a business-specific transaction column mapping for an exact ordered normalized header layout. Exact header fingerprints prevent stale mappings from being applied to changed gateway exports.';

alter table public.customer_transaction_column_mappings enable row level security;

revoke all on public.customer_transaction_column_mappings from anon;
revoke all on public.customer_transaction_column_mappings from authenticated;
grant select, insert, update on public.customer_transaction_column_mappings to authenticated;
grant all on public.customer_transaction_column_mappings to service_role;

create policy customer_transaction_column_mappings_select
on public.customer_transaction_column_mappings for select
to authenticated
using ((select private.can_manage_business(business_id)));

create policy customer_transaction_column_mappings_insert
on public.customer_transaction_column_mappings for insert
to authenticated
with check (
  (select private.can_manage_business(business_id))
  and created_by_user_id = (select auth.uid())
);

create policy customer_transaction_column_mappings_update
on public.customer_transaction_column_mappings for update
to authenticated
using ((select private.can_manage_business(business_id)))
with check ((select private.can_manage_business(business_id)));
