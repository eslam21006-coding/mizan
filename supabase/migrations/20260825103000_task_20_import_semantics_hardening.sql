alter table public.customer_transactions
  add column source_transaction_at text,
  add column transaction_at timestamptz,
  add column currency text,
  add column normalized_outcome text;

alter table public.customer_transaction_duplicate_resolutions
  add column source_transaction_at text,
  add column transaction_at timestamptz,
  add column currency text,
  add column normalized_outcome text;

update public.customer_transactions as transaction
set
  source_transaction_at = to_char(transaction.transaction_date, 'YYYY-MM-DD'),
  transaction_at = transaction.transaction_date::timestamp at time zone business.timezone,
  currency = business.base_currency,
  normalized_outcome = 'successful'
from public.businesses as business
where business.id = transaction.business_id;

update public.customer_transaction_duplicate_resolutions as resolution
set
  source_transaction_at = to_char(resolution.transaction_date, 'YYYY-MM-DD'),
  transaction_at = resolution.transaction_date::timestamp at time zone business.timezone,
  currency = business.base_currency,
  normalized_outcome = 'successful'
from public.businesses as business
where business.id = resolution.business_id;

alter table public.customer_transactions
  alter column source_transaction_at set not null,
  alter column transaction_at set not null,
  alter column currency set not null,
  alter column normalized_outcome set not null,
  add constraint customer_transactions_source_transaction_at_check
    check (char_length(source_transaction_at) between 10 and 80 and source_transaction_at = btrim(source_transaction_at)),
  add constraint customer_transactions_currency_check
    check (currency in ('USD', 'AED', 'SAR', 'EGP', 'KWD', 'QAR', 'JOD', 'EUR')),
  add constraint customer_transactions_outcome_check
    check (normalized_outcome = 'successful');

alter table public.customer_transaction_duplicate_resolutions
  alter column source_transaction_at set not null,
  alter column transaction_at set not null,
  alter column currency set not null,
  alter column normalized_outcome set not null,
  add constraint customer_transaction_resolutions_source_at_check
    check (char_length(source_transaction_at) between 10 and 80 and source_transaction_at = btrim(source_transaction_at)),
  add constraint customer_transaction_resolutions_currency_check
    check (currency in ('USD', 'AED', 'SAR', 'EGP', 'KWD', 'QAR', 'JOD', 'EUR')),
  add constraint customer_transaction_resolutions_outcome_check
    check (normalized_outcome = 'successful');

drop index public.customer_transactions_candidate_lookup_idx;
create index customer_transactions_candidate_lookup_idx
  on public.customer_transactions (
    business_id,
    source,
    customer_email,
    transaction_at,
    amount_collected,
    transaction_type
  );

create index customer_transactions_business_customer_time_idx
  on public.customer_transactions (business_id, customer_email, transaction_at, id);

create or replace function public.import_customer_transactions(
  p_business_id uuid,
  p_source text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_source text := lower(btrim(coalesce(p_source, '')));
  business_timezone text;
  business_currency text;
  source_row jsonb;
  source_transaction_id_value text;
  import_row_token_value uuid;
  customer_email_value text;
  source_transaction_at_value text;
  transaction_at_value timestamptz;
  transaction_date_value date;
  amount_text text;
  amount_value numeric;
  transaction_type_value text;
  normalized_outcome_value text;
  currency_value text;
  row_number_value integer;
  candidate_resolution_value text;
  candidate_resolution_token uuid;
  candidate_lock_key text;
  candidate_match_count integer;
  inserted_transaction_id uuid;
  existing_import public.customer_transactions%rowtype;
  existing_resolution public.customer_transaction_duplicate_resolutions%rowtype;
  affected_rows integer;
  inserted_count integer := 0;
  duplicate_count integer := 0;
  candidate_count integer := 0;
  candidate_collisions jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to import customer transactions.';
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
    raise insufficient_privilege using message = 'Only the business owner or an admin can import customer transactions.';
  end if;

  select business.timezone, business.base_currency
  into business_timezone, business_currency
  from public.businesses as business
  where business.id = p_business_id;

  if not found then
    raise invalid_parameter_value using message = 'Business does not exist.';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names as zone where zone.name = business_timezone
  ) then
    raise invalid_parameter_value using message = 'Business reporting timezone is invalid.';
  end if;

  if char_length(normalized_source) not between 1 and 80 then
    raise invalid_parameter_value using message = 'Transaction source must be between 1 and 80 characters.';
  end if;

  if not exists (
    select 1
    from public.customer_transaction_sources as registered_source
    where registered_source.business_id = p_business_id
      and registered_source.source = normalized_source
  ) then
    raise invalid_parameter_value using message = 'Select a registered transaction source before importing.';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise invalid_parameter_value using message = 'Transaction import rows must be a JSON array.';
  end if;

  if jsonb_array_length(p_rows) not between 1 and 500 then
    raise invalid_parameter_value using message = 'Each transaction import chunk must contain between 1 and 500 rows.';
  end if;

  for source_row in select value from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(source_row) is distinct from 'object' then
      raise invalid_parameter_value using message = 'Every transaction import row must be a JSON object.';
    end if;

    begin
      row_number_value := (source_row ->> 'row_number')::integer;
    exception when others then
      raise invalid_parameter_value using message = 'Transaction source row number must be a positive integer.';
    end;
    if row_number_value is null or row_number_value <= 0 then
      raise invalid_parameter_value using message = 'Transaction source row number must be a positive integer.';
    end if;

    source_transaction_id_value := nullif(btrim(coalesce(source_row ->> 'transaction_id', '')), '');
    if source_transaction_id_value is not null and char_length(source_transaction_id_value) > 512 then
      raise invalid_parameter_value using message = 'Transaction ID must be 512 characters or fewer.';
    end if;

    begin
      import_row_token_value := (source_row ->> 'import_row_token')::uuid;
    exception when others then
      raise invalid_parameter_value using message = 'Import row token must be a UUID.';
    end;
    if import_row_token_value is null then
      raise invalid_parameter_value using message = 'Import row token is required.';
    end if;

    normalized_outcome_value := lower(btrim(coalesce(source_row ->> 'normalized_outcome', '')));
    if normalized_outcome_value <> 'successful' then
      raise invalid_parameter_value using message = 'Only transactions explicitly normalized as successful can be imported.';
    end if;

    currency_value := upper(btrim(coalesce(source_row ->> 'currency', '')));
    if currency_value <> business_currency then
      raise invalid_parameter_value using message = 'Transaction currency must equal the business base currency.';
    end if;

    transaction_type_value := lower(btrim(coalesce(source_row ->> 'transaction_type', '')));
    if transaction_type_value not in ('collection', 'refund') then
      raise invalid_parameter_value using message = 'Transaction type must be collection or refund.';
    end if;

    candidate_resolution_value := nullif(btrim(coalesce(source_row ->> 'candidate_resolution', '')), '');
    if candidate_resolution_value is not null
      and candidate_resolution_value not in ('duplicate', 'keep_distinct') then
      raise invalid_parameter_value using message = 'Candidate resolution must be duplicate or keep_distinct.';
    end if;
    if source_transaction_id_value is not null and candidate_resolution_value is not null then
      raise invalid_parameter_value using message = 'Candidate resolution is only valid for rows without a Transaction ID.';
    end if;

    if candidate_resolution_value is null then
      if nullif(btrim(coalesce(source_row ->> 'candidate_resolution_id', '')), '') is not null then
        raise invalid_parameter_value using message = 'Candidate resolution ID requires a candidate resolution.';
      end if;
      candidate_resolution_token := null;
    else
      begin
        candidate_resolution_token := (source_row ->> 'candidate_resolution_id')::uuid;
      exception when others then
        raise invalid_parameter_value using message = 'Candidate resolution ID must be a UUID.';
      end;
      if candidate_resolution_token is null then
        raise invalid_parameter_value using message = 'Candidate resolution ID is required for candidate resolution.';
      end if;
    end if;

    customer_email_value := lower(btrim(coalesce(source_row ->> 'customer_email', '')));
    if char_length(customer_email_value) not between 3 and 320
      or customer_email_value !~ '^[^[:space:]@]+@[^[:space:]@]+$' then
      raise invalid_parameter_value using message = 'Customer email is invalid.';
    end if;

    source_transaction_at_value := btrim(coalesce(source_row ->> 'transaction_date', ''));
    if char_length(source_transaction_at_value) not between 10 and 80 then
      raise invalid_parameter_value using message = 'Transaction date/time must be a supported ISO value.';
    end if;

    begin
      if source_transaction_at_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        transaction_at_value := source_transaction_at_value::date::timestamp at time zone business_timezone;
      elsif source_transaction_at_value ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then
        transaction_at_value := replace(source_transaction_at_value, ' ', 'T')::timestamptz;
      elsif source_transaction_at_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,9})?)?$' then
        transaction_at_value := replace(source_transaction_at_value, 'T', ' ')::timestamp at time zone business_timezone;
      else
        raise invalid_parameter_value using message = 'Transaction date/time must use supported ISO date or datetime syntax.';
      end if;
    exception
      when datetime_field_overflow or invalid_datetime_format then
        raise invalid_parameter_value using message = 'Transaction date/time is not a real ISO date or datetime.';
    end;
    transaction_date_value := (transaction_at_value at time zone business_timezone)::date;

    amount_text := btrim(coalesce(source_row ->> 'amount_collected', ''));
    if amount_text !~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$' then
      raise invalid_parameter_value using message = 'Amount collected is invalid.';
    end if;
    begin
      amount_value := amount_text::numeric;
    exception when others then
      raise invalid_parameter_value using message = 'Amount collected is outside the supported numeric range.';
    end;

    if transaction_type_value = 'refund' then
      amount_value := abs(amount_value);
    end if;
    if amount_value <= 0 then
      raise invalid_parameter_value using message = 'Collections and refund magnitudes must be positive.';
    end if;

    if candidate_resolution_token is not null then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('resolution:' || candidate_resolution_token::text, 0)
      );
      select resolution.* into existing_resolution
      from public.customer_transaction_duplicate_resolutions as resolution
      where resolution.resolution_token = candidate_resolution_token;

      if found then
        if existing_resolution.business_id <> p_business_id
          or existing_resolution.source <> normalized_source
          or existing_resolution.import_row_token <> import_row_token_value
          or existing_resolution.customer_email <> customer_email_value
          or existing_resolution.source_transaction_at <> source_transaction_at_value
          or existing_resolution.transaction_at <> transaction_at_value
          or existing_resolution.amount_collected <> amount_value
          or existing_resolution.transaction_type <> transaction_type_value
          or existing_resolution.currency <> currency_value
          or existing_resolution.normalized_outcome <> normalized_outcome_value
          or existing_resolution.source_row_number <> row_number_value
          or existing_resolution.decision <> candidate_resolution_value then
          raise invalid_parameter_value using message = 'Candidate resolution ID does not match this candidate decision.';
        end if;

        if existing_resolution.decision = 'duplicate' then duplicate_count := duplicate_count + 1;
        else inserted_count := inserted_count + 1;
        end if;
        continue;
      end if;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('import-row:' || import_row_token_value::text, 0)
    );
    select transaction.* into existing_import
    from public.customer_transactions as transaction
    where transaction.business_id = p_business_id
      and transaction.import_row_token = import_row_token_value;

    if found then
      if candidate_resolution_value is not null
        or existing_import.source <> normalized_source
        or existing_import.source_transaction_id is distinct from source_transaction_id_value
        or existing_import.customer_email <> customer_email_value
        or existing_import.source_transaction_at <> source_transaction_at_value
        or existing_import.transaction_at <> transaction_at_value
        or existing_import.amount_collected <> amount_value
        or existing_import.transaction_type <> transaction_type_value
        or existing_import.currency <> currency_value
        or existing_import.normalized_outcome <> normalized_outcome_value
        or existing_import.source_row_number <> row_number_value then
        raise invalid_parameter_value using message = 'Import row token does not match this transaction row.';
      end if;
      inserted_count := inserted_count + 1;
      continue;
    end if;

    if candidate_resolution_value is not null then
      select resolution.* into existing_resolution
      from public.customer_transaction_duplicate_resolutions as resolution
      where resolution.business_id = p_business_id
        and resolution.import_row_token = import_row_token_value;
      if found then
        if existing_resolution.resolution_token <> candidate_resolution_token
          or existing_resolution.source <> normalized_source
          or existing_resolution.customer_email <> customer_email_value
          or existing_resolution.source_transaction_at <> source_transaction_at_value
          or existing_resolution.transaction_at <> transaction_at_value
          or existing_resolution.amount_collected <> amount_value
          or existing_resolution.transaction_type <> transaction_type_value
          or existing_resolution.currency <> currency_value
          or existing_resolution.normalized_outcome <> normalized_outcome_value
          or existing_resolution.source_row_number <> row_number_value
          or existing_resolution.decision <> candidate_resolution_value then
          raise invalid_parameter_value using message = 'Import row token was already resolved with a different decision.';
        end if;
        if existing_resolution.decision = 'duplicate' then duplicate_count := duplicate_count + 1;
        else inserted_count := inserted_count + 1;
        end if;
        continue;
      end if;
    end if;

    candidate_lock_key := concat_ws(
      E'\x1f',
      p_business_id::text,
      normalized_source,
      customer_email_value,
      to_char(transaction_at_value at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
      pg_catalog.trim_scale(amount_value)::text,
      transaction_type_value
    );
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(candidate_lock_key, 0));

    if source_transaction_id_value is not null then
      insert into public.customer_transactions (
        business_id, source, source_transaction_id, import_row_token, customer_email,
        transaction_date, source_transaction_at, transaction_at, amount_collected,
        transaction_type, normalized_outcome, currency, source_row_number, imported_by_user_id
      ) values (
        p_business_id, normalized_source, source_transaction_id_value, import_row_token_value,
        customer_email_value, transaction_date_value, source_transaction_at_value, transaction_at_value,
        amount_value, transaction_type_value, normalized_outcome_value, currency_value,
        row_number_value, (select auth.uid())
      ) on conflict do nothing;
      get diagnostics affected_rows = row_count;
      if affected_rows = 1 then inserted_count := inserted_count + 1;
      else duplicate_count := duplicate_count + 1;
      end if;
      continue;
    end if;

    select count(*)::integer into candidate_match_count
    from public.customer_transactions as existing
    where existing.business_id = p_business_id
      and existing.source = normalized_source
      and existing.customer_email = customer_email_value
      and existing.transaction_at = transaction_at_value
      and existing.amount_collected = amount_value
      and existing.transaction_type = transaction_type_value;

    if candidate_match_count > 0 then
      if candidate_resolution_value is null then
        candidate_count := candidate_count + 1;
        candidate_collisions := candidate_collisions || jsonb_build_array(
          jsonb_build_object('row_number', row_number_value, 'existing_count', candidate_match_count)
        );
        continue;
      end if;

      if candidate_resolution_value = 'duplicate' then
        insert into public.customer_transaction_duplicate_resolutions (
          resolution_token, import_row_token, business_id, source, customer_email,
          transaction_date, source_transaction_at, transaction_at, amount_collected,
          transaction_type, normalized_outcome, currency, source_row_number, decision,
          candidate_match_count, kept_transaction_id, resolved_by_user_id
        ) values (
          candidate_resolution_token, import_row_token_value, p_business_id, normalized_source,
          customer_email_value, transaction_date_value, source_transaction_at_value, transaction_at_value,
          amount_value, transaction_type_value, normalized_outcome_value, currency_value,
          row_number_value, 'duplicate', candidate_match_count, null, (select auth.uid())
        );
        duplicate_count := duplicate_count + 1;
        continue;
      end if;

      insert into public.customer_transactions (
        business_id, source, source_transaction_id, import_row_token, customer_email,
        transaction_date, source_transaction_at, transaction_at, amount_collected,
        transaction_type, normalized_outcome, currency, source_row_number, imported_by_user_id
      ) values (
        p_business_id, normalized_source, null, import_row_token_value, customer_email_value,
        transaction_date_value, source_transaction_at_value, transaction_at_value, amount_value,
        transaction_type_value, normalized_outcome_value, currency_value, row_number_value,
        (select auth.uid())
      ) returning id into inserted_transaction_id;

      insert into public.customer_transaction_duplicate_resolutions (
        resolution_token, import_row_token, business_id, source, customer_email,
        transaction_date, source_transaction_at, transaction_at, amount_collected,
        transaction_type, normalized_outcome, currency, source_row_number, decision,
        candidate_match_count, kept_transaction_id, resolved_by_user_id
      ) values (
        candidate_resolution_token, import_row_token_value, p_business_id, normalized_source,
        customer_email_value, transaction_date_value, source_transaction_at_value, transaction_at_value,
        amount_value, transaction_type_value, normalized_outcome_value, currency_value, row_number_value,
        'keep_distinct', candidate_match_count, inserted_transaction_id, (select auth.uid())
      );
      inserted_count := inserted_count + 1;
      continue;
    end if;

    if candidate_resolution_value is not null then
      raise invalid_parameter_value using message = 'Candidate resolution was supplied but no matching candidate exists.';
    end if;

    insert into public.customer_transactions (
      business_id, source, source_transaction_id, import_row_token, customer_email,
      transaction_date, source_transaction_at, transaction_at, amount_collected,
      transaction_type, normalized_outcome, currency, source_row_number, imported_by_user_id
    ) values (
      p_business_id, normalized_source, null, import_row_token_value, customer_email_value,
      transaction_date_value, source_transaction_at_value, transaction_at_value, amount_value,
      transaction_type_value, normalized_outcome_value, currency_value, row_number_value,
      (select auth.uid())
    );
    inserted_count := inserted_count + 1;
  end loop;

  return jsonb_build_object(
    'inserted_count', inserted_count,
    'duplicate_count', duplicate_count,
    'candidate_count', candidate_count,
    'candidate_collisions', candidate_collisions
  );
end;
$$;

revoke all on function public.import_customer_transactions(uuid, text, jsonb) from public;
revoke all on function public.import_customer_transactions(uuid, text, jsonb) from anon;
revoke all on function public.import_customer_transactions(uuid, text, jsonb) from authenticated;
grant execute on function public.import_customer_transactions(uuid, text, jsonb) to authenticated;
grant execute on function public.import_customer_transactions(uuid, text, jsonb) to service_role;
