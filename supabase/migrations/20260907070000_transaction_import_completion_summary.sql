create or replace function public.transaction_import_completion_summary(
  p_business_id uuid,
  p_import_row_tokens uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  session_token_count integer;
  persisted_inserted_count integer;
  session_unique_customer_count integer;
  session_first_transaction_date date;
  session_last_transaction_date date;
  session_net_cash_collected numeric;
  business_transaction_count bigint;
  business_unique_customer_count bigint;
  business_first_transaction_date date;
  business_last_transaction_date date;
  business_net_cash_collected numeric;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to verify transaction import completion.';
  end if;

  if not (
    (select private.is_admin())
    or exists (
      select 1
      from public.businesses as business
      where business.id = p_business_id
        and business.owner_user_id = (select auth.uid())
    )
  ) then
    raise insufficient_privilege using message = 'Only the business owner or an admin can verify transaction import completion.';
  end if;

  if p_import_row_tokens is null then
    raise invalid_parameter_value using message = 'Import row tokens are required.';
  end if;

  select count(distinct token)::integer
  into session_token_count
  from pg_catalog.unnest(p_import_row_tokens) as token
  where token is not null;

  if session_token_count < 1 or session_token_count > 100000 then
    raise invalid_parameter_value using message = 'Import completion verification requires between 1 and 100000 unique row tokens.';
  end if;

  select
    count(*)::integer,
    count(distinct transaction.customer_email)::integer,
    min(transaction.transaction_date),
    max(transaction.transaction_date),
    coalesce(
      sum(
        case
          when transaction.transaction_type = 'collection' then transaction.amount_collected
          when transaction.transaction_type = 'refund' then -transaction.amount_collected
          else 0::numeric
        end
      ),
      0::numeric
    )
  into
    persisted_inserted_count,
    session_unique_customer_count,
    session_first_transaction_date,
    session_last_transaction_date,
    session_net_cash_collected
  from public.customer_transactions as transaction
  where transaction.business_id = p_business_id
    and transaction.import_row_token = any(p_import_row_tokens);

  select
    count(*)::bigint,
    count(distinct transaction.customer_email)::bigint,
    min(transaction.transaction_date),
    max(transaction.transaction_date),
    coalesce(
      sum(
        case
          when transaction.transaction_type = 'collection' then transaction.amount_collected
          when transaction.transaction_type = 'refund' then -transaction.amount_collected
          else 0::numeric
        end
      ),
      0::numeric
    )
  into
    business_transaction_count,
    business_unique_customer_count,
    business_first_transaction_date,
    business_last_transaction_date,
    business_net_cash_collected
  from public.customer_transactions as transaction
  where transaction.business_id = p_business_id;

  return pg_catalog.jsonb_build_object(
    'requested_token_count', session_token_count,
    'persisted_inserted_count', persisted_inserted_count,
    'session_unique_customer_count', session_unique_customer_count,
    'session_first_transaction_date', case
      when session_first_transaction_date is null then null
      else session_first_transaction_date::text
    end,
    'session_last_transaction_date', case
      when session_last_transaction_date is null then null
      else session_last_transaction_date::text
    end,
    'session_net_cash_collected', pg_catalog.trim_scale(session_net_cash_collected)::text,
    'business_transaction_count', business_transaction_count,
    'business_unique_customer_count', business_unique_customer_count,
    'business_first_transaction_date', case
      when business_first_transaction_date is null then null
      else business_first_transaction_date::text
    end,
    'business_last_transaction_date', case
      when business_last_transaction_date is null then null
      else business_last_transaction_date::text
    end,
    'business_net_cash_collected', pg_catalog.trim_scale(business_net_cash_collected)::text
  );
end;
$$;

revoke all on function public.transaction_import_completion_summary(uuid, uuid[]) from public;
revoke all on function public.transaction_import_completion_summary(uuid, uuid[]) from anon;
revoke all on function public.transaction_import_completion_summary(uuid, uuid[]) from authenticated;
grant execute on function public.transaction_import_completion_summary(uuid, uuid[]) to authenticated;
grant execute on function public.transaction_import_completion_summary(uuid, uuid[]) to service_role;

comment on function public.transaction_import_completion_summary(uuid, uuid[]) is
  'Verifies newly persisted transaction rows by stable import-row token and returns exact post-import business totals for completion UX. Read-only members cannot execute it; transaction/customer economics remain derived from persisted customer_transactions.';
