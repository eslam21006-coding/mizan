begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('76767676-7676-4767-8767-767676760001', 'task5-hardening-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('76767676-7676-4767-8767-767676760002', 'task5-hardening-outsider@example.test', '{"role":"mentee"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values (
  '76767676-aaaa-4767-8767-76767676a001',
  'Task 5 Hardening Business',
  'USD',
  'Africa/Cairo',
  '76767676-7676-4767-8767-767676760001',
  '76767676-bbbb-4767-8767-76767676c001'
);

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
)
values (
  '76767676-aaaa-4767-8767-76767676e001',
  '76767676-aaaa-4767-8767-76767676a001',
  'Task 5 Acquisition Pool',
  'acquisition',
  'fixed_monthly',
  '76767676-bbbb-4767-8767-76767676d001'
);

insert into public.monthly_periods (
  id, business_id, month_start, new_customers, total_paying_customers,
  unallocated_gross_cash_collected, unallocated_refunds
)
values
  ('76767676-aaaa-4767-8767-76767676f001', '76767676-aaaa-4767-8767-76767676a001', '2026-01-01', 1, 1, 100, 0),
  ('76767676-aaaa-4767-8767-76767676f002', '76767676-aaaa-4767-8767-76767676a001', '2026-02-01', 1, 1, 100, 0),
  ('76767676-aaaa-4767-8767-76767676f003', '76767676-aaaa-4767-8767-76767676a001', '2026-03-01', 0, 0, 0, 0);

insert into public.monthly_expense_entries (
  id, business_id, monthly_period_id, expense_item_id,
  expense_name_snapshot, category_snapshot, cost_behavior_snapshot,
  input_value, customer_count_basis
)
values
  (
    '76767676-aaaa-4767-8767-767676761001',
    '76767676-aaaa-4767-8767-76767676a001',
    '76767676-aaaa-4767-8767-76767676f001',
    '76767676-aaaa-4767-8767-76767676e001',
    'Task 5 Acquisition Pool', 'acquisition', 'fixed_monthly', 300, null
  ),
  (
    '76767676-aaaa-4767-8767-767676761002',
    '76767676-aaaa-4767-8767-76767676a001',
    '76767676-aaaa-4767-8767-76767676f002',
    '76767676-aaaa-4767-8767-76767676e001',
    'Task 5 Acquisition Pool', 'acquisition', 'fixed_monthly', null, null
  ),
  (
    '76767676-aaaa-4767-8767-767676761003',
    '76767676-aaaa-4767-8767-76767676a001',
    '76767676-aaaa-4767-8767-76767676f003',
    '76767676-aaaa-4767-8767-76767676e001',
    'Task 5 Acquisition Pool', 'acquisition', 'fixed_monthly', 2000, null
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"76767676-7676-4767-8767-767676760001","role":"authenticated","app_metadata":{"role":"mentee"}}';
select public.create_customer_transaction_source(
  '76767676-aaaa-4767-8767-76767676a001',
  'task5-hardening-fixture'
);
reset role;

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency, normalized_outcome
)
values
  (
    '76767676-aaaa-4767-8767-76767676a001', 'task5-hardening-fixture', 'jan-customer',
    gen_random_uuid(), 'jan-hardening@example.test', '2026-01-05', 100, 'collection', 1,
    '76767676-7676-4767-8767-767676760001', '2026-01-05T10:00:00Z', '2026-01-05T10:00:00Z', 'USD', 'successful'
  ),
  (
    '76767676-aaaa-4767-8767-76767676a001', 'task5-hardening-fixture', 'feb-customer',
    gen_random_uuid(), 'feb-hardening@example.test', '2026-02-05', 100, 'collection', 2,
    '76767676-7676-4767-8767-767676760001', '2026-02-05T10:00:00Z', '2026-02-05T10:00:00Z', 'USD', 'successful'
  );

insert into public.business_transaction_history_status (
  business_id, is_complete, confirmed_at, confirmed_by_user_id
)
values (
  '76767676-aaaa-4767-8767-76767676a001',
  true,
  now(),
  '76767676-7676-4767-8767-767676760001'
)
on conflict (business_id) do update set
  is_complete = excluded.is_complete,
  confirmed_at = excluded.confirmed_at,
  confirmed_by_user_id = excluded.confirmed_by_user_id;

-- First create a legitimate exception-only override while March has no new customers.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"76767676-7676-4767-8767-767676760001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  override_id uuid;
begin
  override_id := public.save_customer_economics_manual_override(
    '76767676-aaaa-4767-8767-76767676a001',
    '76767676-aaaa-4767-8767-767676761003',
    '[{"cohort_month":"2026-01-01","amount":"1200"},{"cohort_month":"2026-02-01","amount":"800"}]'::jsonb,
    'Initial zero-new-customer exception'
  );

  if override_id is null then
    raise exception 'Hardening fixture could not create the initial valid override';
  end if;
end;
$$;
reset role;

-- New evidence makes the March pool automatically allocatable, then the authoritative amount
-- changes. The active override is now stale while the underlying plan has no allocation exception.
insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency, normalized_outcome
)
values (
  '76767676-aaaa-4767-8767-76767676a001', 'task5-hardening-fixture', 'mar-customer',
  gen_random_uuid(), 'mar-hardening@example.test', '2026-03-05', 100, 'collection', 3,
  '76767676-7676-4767-8767-767676760001', '2026-03-05T10:00:00Z', '2026-03-05T10:00:00Z', 'USD', 'successful'
);

update public.monthly_expense_entries
set input_value = 2100
where id = '76767676-aaaa-4767-8767-767676761003';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"76767676-7676-4767-8767-767676760001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  old_override_id uuid;
  replacement_override_id uuid;
  status_row record;
  plan_exception text;
begin
  select status.override_id
  into strict old_override_id
  from public.customer_economics_manual_override_status as status
  where status.authoritative_source_id = '76767676-aaaa-4767-8767-767676761003';

  select plan.allocation_exception_reason
  into plan_exception
  from public.customer_economics_cost_pool_plan as plan
  where plan.authoritative_source_id = '76767676-aaaa-4767-8767-767676761003';

  if plan_exception is not null then
    raise exception 'Hardening fixture expected the underlying March pool to be automatically allocatable';
  end if;

  select * into strict status_row
  from public.customer_economics_manual_override_status as status
  where status.override_id = old_override_id;

  if status_row.is_valid is not false
     or status_row.invalid_reason is distinct from 'MANUAL_OVERRIDE_STALE_AMOUNT' then
    raise exception 'Hardening fixture did not produce the intended stale active override';
  end if;

  replacement_override_id := public.save_customer_economics_manual_override(
    '76767676-aaaa-4767-8767-76767676a001',
    '76767676-aaaa-4767-8767-767676761003',
    '[{"cohort_month":"2026-01-01","amount":"1200"},{"cohort_month":"2026-02-01","amount":"900"}]'::jsonb,
    'Replace stale override after authoritative evidence changed'
  );

  if replacement_override_id = old_override_id then
    raise exception 'Invalid active override was not versioned when replaced';
  end if;

  if not exists (
    select 1
    from public.customer_economics_manual_overrides
    where id = old_override_id
      and superseded_at is not null
  ) then
    raise exception 'Old stale override was not preserved as superseded audit history';
  end if;

  select * into strict status_row
  from public.customer_economics_manual_override_status as status
  where status.override_id = replacement_override_id;

  if status_row.is_valid is not true
     or status_row.current_authoritative_amount is distinct from 2100
     or status_row.allocated_amount is distinct from 2100 then
    raise exception 'Replacement override did not reconcile the current 2,100 authoritative pool';
  end if;
end;
$$;

-- Copying previous-month expenses may backfill a missing historical month, but it must never
-- change an already-existing historical month outside the audited correction workflow.
do $$
declare
  copied_result record;
begin
  begin
    perform public.copy_previous_month_expenses(
      '76767676-aaaa-4767-8767-76767676a001',
      '2026-02-01'
    );
    raise exception 'Copy previous month changed an already-existing historical month';
  exception when invalid_parameter_value then null;
  end;

  select * into strict copied_result
  from public.copy_previous_month_expenses(
    '76767676-aaaa-4767-8767-76767676a001',
    '2026-04-01'
  );

  if copied_result.previous_month_found is not true
     or copied_result.copied_count <> 1 then
    raise exception 'Missing historical month could not be backfilled from the previous month';
  end if;

  if not exists (
    select 1
    from public.monthly_periods as period
    join public.monthly_expense_entries as expense
      on expense.monthly_period_id = period.id
    where period.business_id = '76767676-aaaa-4767-8767-76767676a001'
      and period.month_start = '2026-04-01'
      and expense.expense_item_id = '76767676-aaaa-4767-8767-76767676e001'
      and expense.input_value = 2100
  ) then
    raise exception 'Missing historical copy backfill did not preserve the previous month expense value';
  end if;
end;
$$;

-- The historical existence check must occur only after the same transaction lock used by the
-- underlying monthly save helper, and the historical guard must run before any copy helper write.
do $$
declare
  save_definition text;
  copy_definition text;
begin
  save_definition := pg_catalog.pg_get_functiondef(
    'public.save_monthly_actuals(uuid,date,integer,integer,numeric,numeric,text,jsonb,jsonb)'::regprocedure
  );
  copy_definition := pg_catalog.pg_get_functiondef(
    'public.copy_previous_month_expenses(uuid,date)'::regprocedure
  );

  if strpos(save_definition, 'pg_advisory_xact_lock') = 0
     or strpos(save_definition, 'select exists') = 0
     or strpos(save_definition, 'pg_advisory_xact_lock') > strpos(save_definition, 'select exists') then
    raise exception 'Normal monthly save does not serialize before the historical existence check';
  end if;

  if strpos(copy_definition, 'pg_advisory_xact_lock') = 0
     or strpos(copy_definition, 'select exists') = 0
     or strpos(copy_definition, 'pg_advisory_xact_lock') > strpos(copy_definition, 'select exists') then
    raise exception 'Copy previous month does not serialize before the historical existence check';
  end if;

  if strpos(copy_definition, 'existing_period and target_month_start < business_current_month') = 0
     or strpos(copy_definition, 'private.copy_previous_month_expenses_unchecked') = 0
     or strpos(copy_definition, 'existing_period and target_month_start < business_current_month')
        > strpos(copy_definition, 'private.copy_previous_month_expenses_unchecked') then
    raise exception 'Historical copy guard does not execute before the unchecked copy helper';
  end if;
end;
$$;

-- Tenant isolation still applies to the hardened copy wrapper.
set local request.jwt.claims =
  '{"sub":"76767676-7676-4767-8767-767676760002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.copy_previous_month_expenses(
      '76767676-aaaa-4767-8767-76767676a001',
      '2026-05-01'
    );
    raise exception 'Outsider copied expenses into another business';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
