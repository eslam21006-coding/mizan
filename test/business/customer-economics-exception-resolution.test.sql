begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('75757575-7575-4757-8757-757575750001', 'task5-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('75757575-7575-4757-8757-757575750002', 'task5-outsider@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('75757575-7575-4757-8757-757575750003', 'task5-admin@example.test', '{"role":"admin"}'::jsonb, now(), now()),
  ('75757575-7575-4757-8757-757575750004', 'task5-correction-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  (
    '75757575-aaaa-4757-8757-75757575a001',
    'Task 5 Override Business',
    'USD',
    'Africa/Cairo',
    '75757575-7575-4757-8757-757575750001',
    '75757575-bbbb-4757-8757-75757575c001'
  ),
  (
    '75757575-aaaa-4757-8757-75757575a002',
    'Task 5 Incomplete Business',
    'USD',
    'Africa/Cairo',
    '75757575-7575-4757-8757-757575750002',
    '75757575-bbbb-4757-8757-75757575c002'
  ),
  (
    '75757575-aaaa-4757-8757-75757575a003',
    'Task 5 Historical Correction',
    'USD',
    'Africa/Cairo',
    '75757575-7575-4757-8757-757575750004',
    '75757575-bbbb-4757-8757-75757575c003'
  );

insert into public.expense_items (
  id, business_id, name, category, cost_behavior, creation_request_id
)
values
  (
    '75757575-aaaa-4757-8757-75757575e001',
    '75757575-aaaa-4757-8757-75757575a001',
    'Acquisition Exception Pool',
    'acquisition',
    'fixed_monthly',
    '75757575-bbbb-4757-8757-75757575d001'
  ),
  (
    '75757575-aaaa-4757-8757-75757575e002',
    '75757575-aaaa-4757-8757-75757575a001',
    'Legacy Acquisition Pool',
    'acquisition',
    'fixed_monthly',
    '75757575-bbbb-4757-8757-75757575d002'
  ),
  (
    '75757575-aaaa-4757-8757-75757575e003',
    '75757575-aaaa-4757-8757-75757575a002',
    'Incomplete History Pool',
    'acquisition',
    'fixed_monthly',
    '75757575-bbbb-4757-8757-75757575d003'
  );

insert into public.monthly_periods (
  id, business_id, month_start, new_customers, total_paying_customers,
  unallocated_gross_cash_collected, unallocated_refunds
)
values
  ('75757575-aaaa-4757-8757-75757575f001', '75757575-aaaa-4757-8757-75757575a001', '2026-01-01', 1, 1, 100, 0),
  ('75757575-aaaa-4757-8757-75757575f002', '75757575-aaaa-4757-8757-75757575a001', '2026-02-01', 1, 1, 100, 0),
  ('75757575-aaaa-4757-8757-75757575f003', '75757575-aaaa-4757-8757-75757575a001', '2026-03-01', 0, 0, 0, 0),
  ('75757575-aaaa-4757-8757-75757575f004', '75757575-aaaa-4757-8757-75757575a001', '2026-04-01', 0, 0, 0, 0),
  ('75757575-aaaa-4757-8757-75757575f005', '75757575-aaaa-4757-8757-75757575a002', '2026-03-01', 0, 0, 0, 0),
  ('75757575-aaaa-4757-8757-75757575f006', '75757575-aaaa-4757-8757-75757575a003', '2026-08-01', 2, 2, 100, 0);

insert into public.monthly_expense_entries (
  id, business_id, monthly_period_id, expense_item_id,
  expense_name_snapshot, category_snapshot, cost_behavior_snapshot,
  input_value, customer_count_basis
)
values
  (
    '75757575-aaaa-4757-8757-757575751001',
    '75757575-aaaa-4757-8757-75757575a001',
    '75757575-aaaa-4757-8757-75757575f003',
    '75757575-aaaa-4757-8757-75757575e001',
    'Acquisition Exception Pool',
    'acquisition',
    'fixed_monthly',
    2000,
    null
  ),
  (
    '75757575-aaaa-4757-8757-757575751002',
    '75757575-aaaa-4757-8757-75757575a001',
    '75757575-aaaa-4757-8757-75757575f004',
    '75757575-aaaa-4757-8757-75757575e002',
    'Legacy Acquisition Pool',
    'acquisition',
    'fixed_monthly',
    5000,
    null
  ),
  (
    '75757575-aaaa-4757-8757-757575751003',
    '75757575-aaaa-4757-8757-75757575a002',
    '75757575-aaaa-4757-8757-75757575f005',
    '75757575-aaaa-4757-8757-75757575e003',
    'Incomplete History Pool',
    'acquisition',
    'fixed_monthly',
    1000,
    null
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"75757575-7575-4757-8757-757575750001","role":"authenticated","app_metadata":{"role":"mentee"}}';
select public.create_customer_transaction_source(
  '75757575-aaaa-4757-8757-75757575a001',
  'task5-fixture'
);
reset role;

insert into public.customer_transactions (
  business_id, source, source_transaction_id, import_row_token, customer_email,
  transaction_date, amount_collected, transaction_type, source_row_number,
  imported_by_user_id, source_transaction_at, transaction_at, currency, normalized_outcome
)
values
  (
    '75757575-aaaa-4757-8757-75757575a001', 'task5-fixture', 'jan-customer',
    gen_random_uuid(), 'jan-customer@example.test', '2026-01-05', 100, 'collection', 1,
    '75757575-7575-4757-8757-757575750001', '2026-01-05T10:00:00Z', '2026-01-05T10:00:00Z', 'USD', 'successful'
  ),
  (
    '75757575-aaaa-4757-8757-75757575a001', 'task5-fixture', 'feb-customer',
    gen_random_uuid(), 'feb-customer@example.test', '2026-02-05', 100, 'collection', 2,
    '75757575-7575-4757-8757-757575750001', '2026-02-05T10:00:00Z', '2026-02-05T10:00:00Z', 'USD', 'successful'
  );

insert into public.business_transaction_history_status (
  business_id, is_complete, confirmed_at, confirmed_by_user_id
)
values
  ('75757575-aaaa-4757-8757-75757575a001', true, now(), '75757575-7575-4757-8757-757575750001'),
  ('75757575-aaaa-4757-8757-75757575a002', false, null, null)
on conflict (business_id) do update set
  is_complete = excluded.is_complete,
  confirmed_at = excluded.confirmed_at,
  confirmed_by_user_id = excluded.confirmed_by_user_id;

-- Preserve two old manual allocations for the separate 5,000 authoritative pool.
insert into public.customer_cohort_cost_allocations (
  id, business_id, cohort_month, cost_type, amount, attribution_method,
  note, created_by_user_id, updated_by_user_id
)
values
  (
    '75757575-aaaa-4757-8757-757575752001',
    '75757575-aaaa-4757-8757-75757575a001',
    '2026-01-01',
    'acquisition',
    3000,
    'explicit_allocation',
    'Legacy January allocation',
    '75757575-7575-4757-8757-757575750001',
    '75757575-7575-4757-8757-757575750001'
  ),
  (
    '75757575-aaaa-4757-8757-757575752002',
    '75757575-aaaa-4757-8757-75757575a001',
    '2026-02-01',
    'acquisition',
    2000,
    'explicit_allocation',
    'Legacy February allocation',
    '75757575-7575-4757-8757-757575750001',
    '75757575-7575-4757-8757-757575750001'
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"75757575-7575-4757-8757-757575750001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  exception_row record;
  reconciliation_row record;
  override_id uuid;
  direct_insert_denied boolean := false;
begin
  select * into strict exception_row
  from public.customer_economics_review_exceptions
  where authoritative_source_id = '75757575-aaaa-4757-8757-757575751001';

  if exception_row.exception_code is distinct from 'NO_NEW_CUSTOMERS'
     or exception_row.amount is distinct from 2000
     or exception_row.can_manual_override is not true
     or exception_row.blocking is not true then
    raise exception 'Task 5 review queue did not expose the unresolved 2,000 acquisition pool correctly';
  end if;

  begin
    insert into public.customer_economics_manual_overrides (
      business_id,
      authoritative_source_type,
      authoritative_source_id,
      authoritative_amount_snapshot,
      reason,
      created_by_user_id
    ) values (
      '75757575-aaaa-4757-8757-75757575a001',
      'monthly_expense_entry',
      '75757575-aaaa-4757-8757-757575751001',
      2000,
      'Bypass attempt',
      '75757575-7575-4757-8757-757575750001'
    );
  exception when insufficient_privilege then
    direct_insert_denied := true;
  end;

  if not direct_insert_denied then
    raise exception 'Authenticated owner bypassed the exception RPC with a direct manual-override insert';
  end if;

  begin
    perform public.save_customer_economics_manual_override(
      '75757575-aaaa-4757-8757-75757575a001',
      '75757575-aaaa-4757-8757-757575751001',
      '[{"cohort_month":"2026-01-01","amount":"1200"},{"cohort_month":"2026-02-01","amount":"700"}]'::jsonb,
      'Bad sum must fail'
    );
    raise exception 'Manual override sum mismatch was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.save_customer_economics_manual_override(
      '75757575-aaaa-4757-8757-75757575a001',
      '75757575-aaaa-4757-8757-757575751001',
      '[{"cohort_month":"2026-01-01","amount":"1200"},{"cohort_month":"2026-05-01","amount":"800"}]'::jsonb,
      'Untrusted cohort must fail'
    );
    raise exception 'Manual override accepted an untrusted acquisition group';
  exception when invalid_parameter_value then null;
  end;

  override_id := public.save_customer_economics_manual_override(
    '75757575-aaaa-4757-8757-75757575a001',
    '75757575-aaaa-4757-8757-757575751001',
    '[{"cohort_month":"2026-01-01","amount":"1200"},{"cohort_month":"2026-02-01","amount":"800"}]'::jsonb,
    'Resolve zero-new acquisition exception from known history'
  );

  if override_id is null then
    raise exception 'Manual override did not return an audit identifier';
  end if;

  select * into strict reconciliation_row
  from public.customer_economics_cost_pool_reconciliation
  where authoritative_source_id = '75757575-aaaa-4757-8757-757575751001';

  if reconciliation_row.authoritative_amount is distinct from 2000
     or reconciliation_row.allocated_amount is distinct from 2000
     or reconciliation_row.unallocated_amount is distinct from 0
     or reconciliation_row.reconciliation_difference is distinct from 0
     or reconciliation_row.reconciles is not true
     or reconciliation_row.allocation_quality_state is distinct from 'estimated'
     or reconciliation_row.allocation_exception_reason is not null then
    raise exception 'Exact 1,200 + 800 manual override did not reconcile the same 2,000 authoritative pool';
  end if;

  if (select allocated_amount
      from public.customer_economics_cost_allocations
      where authoritative_source_id = '75757575-aaaa-4757-8757-757575751001'
        and cohort_month = '2026-01-01') is distinct from 1200
     or (select allocated_amount
         from public.customer_economics_cost_allocations
         where authoritative_source_id = '75757575-aaaa-4757-8757-757575751001'
           and cohort_month = '2026-02-01') is distinct from 800
     or exists (
       select 1
       from public.customer_economics_cost_allocations
       where authoritative_source_id = '75757575-aaaa-4757-8757-757575751001'
         and allocation_provenance <> 'manual_override'
     ) then
    raise exception 'Manual override allocation amounts/provenance are wrong';
  end if;

  if exists (
    select 1
    from public.customer_economics_review_exceptions
    where authoritative_source_id = '75757575-aaaa-4757-8757-757575751001'
  ) then
    raise exception 'Resolved authoritative pool remained in the founder review queue';
  end if;
end;
$$;

-- Incomplete history must block acquisition-group override even for that business owner.
set local request.jwt.claims =
  '{"sub":"75757575-7575-4757-8757-757575750002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.save_customer_economics_manual_override(
      '75757575-aaaa-4757-8757-75757575a002',
      '75757575-aaaa-4757-8757-757575751003',
      '[{"cohort_month":"2026-01-01","amount":"1000"}]'::jsonb,
      'Must fail while history is incomplete'
    );
    raise exception 'Incomplete transaction history accepted a manual acquisition-group override';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

-- An outsider cannot write against another business even through the RPC.
set local request.jwt.claims =
  '{"sub":"75757575-7575-4757-8757-757575750002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.save_customer_economics_manual_override(
      '75757575-aaaa-4757-8757-75757575a001',
      '75757575-aaaa-4757-8757-757575751001',
      '[{"cohort_month":"2026-01-01","amount":"1000"},{"cohort_month":"2026-02-01","amount":"1000"}]'::jsonb,
      'Outsider must fail'
    );
    raise exception 'Outsider resolved another business Customer Economics exception';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Admin reconciliation must preserve legacy audit data but link it to exactly one real pool.
set local request.jwt.claims =
  '{"sub":"75757575-7575-4757-8757-757575750003","role":"authenticated","app_metadata":{"role":"admin"}}';

do $$
declare
  override_id uuid;
  reconciliation_row record;
begin
  override_id := public.reconcile_customer_economics_legacy_allocations(
    '75757575-aaaa-4757-8757-75757575a001',
    '75757575-aaaa-4757-8757-757575751002',
    '["75757575-aaaa-4757-8757-757575752001","75757575-aaaa-4757-8757-757575752002"]'::jsonb,
    'Reconcile preserved legacy allocations to the April acquisition pool'
  );

  if override_id is null then
    raise exception 'Admin legacy reconciliation returned no audit override identifier';
  end if;

  if (select count(*)
      from public.customer_economics_legacy_reconciliations
      where manual_override_id = override_id) <> 2 then
    raise exception 'Legacy reconciliation did not preserve both audit mappings';
  end if;

  select * into strict reconciliation_row
  from public.customer_economics_cost_pool_reconciliation
  where authoritative_source_id = '75757575-aaaa-4757-8757-757575751002';

  if reconciliation_row.authoritative_amount is distinct from 5000
     or reconciliation_row.allocated_amount is distinct from 5000
     or reconciliation_row.unallocated_amount is distinct from 0
     or reconciliation_row.reconciles is not true
     or reconciliation_row.allocation_quality_state is distinct from 'estimated' then
    raise exception 'Legacy reconciliation did not resolve exactly one 5,000 authoritative pool';
  end if;

  if exists (
    select 1
    from public.customer_economics_review_exceptions
    where business_id = '75757575-aaaa-4757-8757-75757575a001'
      and exception_code = 'LEGACY_MANUAL_UNRECONCILED'
  ) then
    raise exception 'Reconciled legacy allocation remained unresolved in review queue';
  end if;
end;
$$;

-- Normal saves cannot alter an existing historical month. The explicit correction path can,
-- records before/after state, and does not require the founder to translate this into DB logic.
set local request.jwt.claims =
  '{"sub":"75757575-7575-4757-8757-757575750004","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  saved_period_id uuid;
  audit_row record;
begin
  begin
    perform public.save_monthly_actuals(
      '75757575-aaaa-4757-8757-75757575a003',
      '2026-08-01',
      3,
      3,
      150,
      0,
      'Normal historical edit must fail',
      '[]'::jsonb,
      '[]'::jsonb
    );
    raise exception 'Normal monthly save altered an existing historical period';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.correct_historical_monthly_actuals(
      '75757575-aaaa-4757-8757-75757575a003',
      '2026-08-01',
      3,
      3,
      150,
      0,
      'Corrected August actual',
      '[]'::jsonb,
      '[]'::jsonb,
      ''
    );
    raise exception 'Historical correction accepted an empty audit reason';
  exception when invalid_parameter_value then null;
  end;

  saved_period_id := public.correct_historical_monthly_actuals(
    '75757575-aaaa-4757-8757-75757575a003',
    '2026-08-01',
    3,
    3,
    150,
    0,
    'Corrected August actual',
    '[]'::jsonb,
    '[]'::jsonb,
    'Correct an August reporting error'
  );

  if saved_period_id is distinct from '75757575-aaaa-4757-8757-75757575f006'::uuid then
    raise exception 'Historical correction did not update the existing monthly period';
  end if;

  select * into strict audit_row
  from public.monthly_historical_corrections
  where monthly_period_id = saved_period_id;

  if audit_row.reason is distinct from 'Correct an August reporting error'
     or audit_row.before_snapshot #>> '{period,unallocated_gross_cash_collected}' is distinct from '100'
     or audit_row.after_snapshot #>> '{period,unallocated_gross_cash_collected}' is distinct from '150' then
    raise exception 'Historical correction did not preserve the expected before/after audit trail';
  end if;

  if (select unallocated_gross_cash_collected
      from public.monthly_periods
      where id = saved_period_id) is distinct from 150 then
    raise exception 'Explicit historical correction did not persist the corrected amount';
  end if;
end;
$$;

-- A different mentee cannot invoke the correction RPC against that business.
set local request.jwt.claims =
  '{"sub":"75757575-7575-4757-8757-757575750002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  begin
    perform public.correct_historical_monthly_actuals(
      '75757575-aaaa-4757-8757-75757575a003',
      '2026-08-01',
      4,
      4,
      200,
      0,
      'Outsider correction',
      '[]'::jsonb,
      '[]'::jsonb,
      'Must be rejected'
    );
    raise exception 'Outsider corrected another business historical actuals';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Missing historical periods remain backfillable through normal entry; the guard applies only
-- to edits of an already-existing past month.
set local request.jwt.claims =
  '{"sub":"75757575-7575-4757-8757-757575750004","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  perform public.save_monthly_actuals(
    '75757575-aaaa-4757-8757-75757575a003',
    '2026-07-01',
    1,
    1,
    50,
    0,
    'Historical backfill',
    '[]'::jsonb,
    '[]'::jsonb
  );

  if not exists (
    select 1
    from public.monthly_periods
    where business_id = '75757575-aaaa-4757-8757-75757575a003'
      and month_start = '2026-07-01'
      and unallocated_gross_cash_collected = 50
  ) then
    raise exception 'Normal backfill of a missing historical month was incorrectly blocked';
  end if;
end;
$$;

reset role;
set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform public.save_customer_economics_manual_override(
      '75757575-aaaa-4757-8757-75757575a001',
      '75757575-aaaa-4757-8757-757575751001',
      '[{"cohort_month":"2026-01-01","amount":"1200"},{"cohort_month":"2026-02-01","amount":"800"}]'::jsonb,
      'Anonymous must fail'
    );
    raise exception 'Anonymous user invoked the manual override RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;