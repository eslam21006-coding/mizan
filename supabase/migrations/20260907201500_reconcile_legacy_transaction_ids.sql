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
  -- a legacy no-ID row. This keeps concurrent retries on different signatures from racing into the
  -- partial unique source-ID index while preserving the guarded RPC's ON CONFLICT behavior.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      concat_ws(
        E'\x1f',
        'source-transaction-id',
        new.business_id::text,
        new.source,
        new.source_transaction_id
      ),
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

  -- Serialize legacy reconciliation on the exact source row + transaction facts. The source-row
  -- constraint keeps this repair scoped to a re-import of the same gateway row instead of treating
  -- a legitimate later same-value purchase as a duplicate merely because its signature is similar.
  reconciliation_lock_key := concat_ws(
    E'\x1f',
    new.business_id::text,
    new.source,
    new.source_row_number::text,
    new.customer_email,
    new.source_transaction_at,
    to_char(new.transaction_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    pg_catalog.trim_scale(new.amount_collected)::text,
    new.transaction_type,
    new.currency,
    new.normalized_outcome
  );
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
