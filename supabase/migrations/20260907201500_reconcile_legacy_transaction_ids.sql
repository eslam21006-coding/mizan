create or replace function private.reconcile_legacy_customer_transaction_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  legacy_transaction_id uuid;
  reconciliation_lock_key text;
begin
  if new.source_transaction_id is null then
    return new;
  end if;

  -- Serialize every use of one definitive gateway ID before looking for either an existing ID or
  -- a legacy no-ID row. JSON preserves component boundaries and explicit nulls in the lock identity.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.jsonb_build_array(
        'source-transaction-id',
        new.business_id,
        new.source,
        new.source_transaction_id
      )::text,
      0
    )
  );

  -- A stable source ID already stored for this business/source remains the definitive duplicate key.
  if exists (
    select 1
    from public.customer_transactions as existing
    where existing.business_id = new.business_id
      and existing.source = new.source
      and existing.source_transaction_id = new.source_transaction_id
  ) then
    return new;
  end if;

  -- Serialize legacy reconciliation on the exact source row + transaction facts. source_transaction_at
  -- is intentionally preserved as source text; transaction_at is rendered in UTC so its identity is
  -- independent of the database session TimeZone. JSON keeps nulls and delimiters unambiguous.
  reconciliation_lock_key := pg_catalog.jsonb_build_array(
    new.business_id,
    new.source,
    new.source_row_number,
    new.customer_email,
    new.source_transaction_at,
    to_char(new.transaction_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    pg_catalog.trim_scale(new.amount_collected)::text,
    new.transaction_type,
    new.currency,
    new.normalized_outcome
  )::text;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('legacy-transaction-id:' || reconciliation_lock_key, 0)
  );

  -- Recheck the definitive key after taking both reconciliation locks.
  if exists (
    select 1
    from public.customer_transactions as existing
    where existing.business_id = new.business_id
      and existing.source = new.source
      and existing.source_transaction_id = new.source_transaction_id
  ) then
    return new;
  end if;

  select existing.id
  into legacy_transaction_id
  from public.customer_transactions as existing
  where existing.business_id = new.business_id
    and existing.source = new.source
    and existing.source_transaction_id is null
    and existing.source_row_number = new.source_row_number
    and existing.customer_email = new.customer_email
    and existing.source_transaction_at = new.source_transaction_at
    and existing.transaction_at = new.transaction_at
    and existing.amount_collected = new.amount_collected
    and existing.transaction_type = new.transaction_type
    and existing.currency = new.currency
    and existing.normalized_outcome = new.normalized_outcome
  order by existing.created_at, existing.id
  limit 1
  for update;

  if legacy_transaction_id is null then
    return new;
  end if;

  update public.customer_transactions
  set source_transaction_id = new.source_transaction_id
  where id = legacy_transaction_id;

  -- Returning null cancels the duplicate INSERT. The guarded import RPC therefore records this as
  -- a duplicate/reconciled row without changing cash, customer counts, cohorts, or LTV.
  return null;
end;
$$;

revoke all on function private.reconcile_legacy_customer_transaction_id() from public;
revoke all on function private.reconcile_legacy_customer_transaction_id() from anon;
revoke all on function private.reconcile_legacy_customer_transaction_id() from authenticated;
revoke all on function private.reconcile_legacy_customer_transaction_id() from service_role;

drop trigger if exists reconcile_legacy_customer_transaction_id on public.customer_transactions;
create trigger reconcile_legacy_customer_transaction_id
  before insert on public.customer_transactions
  for each row
  execute function private.reconcile_legacy_customer_transaction_id();

comment on function private.reconcile_legacy_customer_transaction_id() is
  'Attaches a newly available gateway Transaction ID to one exact legacy no-ID source row during re-import, then suppresses the duplicate insert. Different source rows remain distinct purchases.';
