begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('25252525-2525-4252-8252-252525252001', 'task25-owner-a@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('25252525-2525-4252-8252-252525252002', 'task25-owner-b@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('25252525-2525-4252-8252-252525252003', 'task25-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('25252525-2525-4252-8252-252525252004', 'task25-admin@example.test', '{"role":"admin"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  ('25252525-2525-4252-8252-25252525a001', 'Task 25 Business A', 'EGP', 'Africa/Cairo', '25252525-2525-4252-8252-252525252001', '25252525-2525-4252-8252-25252525c001'),
  ('25252525-2525-4252-8252-25252525b002', 'Task 25 Business B', 'SAR', 'Asia/Riyadh', '25252525-2525-4252-8252-252525252002', '25252525-2525-4252-8252-25252525c002');

insert into public.business_memberships (business_id, user_id, membership_role)
values ('25252525-2525-4252-8252-25252525a001', '25252525-2525-4252-8252-252525252003', 'member');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"25252525-2525-4252-8252-252525252001","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source('25252525-2525-4252-8252-25252525a001', 'stripe');
select public.import_customer_transactions(
  '25252525-2525-4252-8252-25252525a001',
  'stripe',
  '[
    {"row_number":1,"transaction_id":"cash-1","import_row_token":"25252525-2525-4252-8252-25252525f001","customer_email":"only@example.com","transaction_date":"2026-01-05T10:00:00Z","amount_collected":"10000","transaction_type":"collection","normalized_outcome":"successful","currency":"EGP"}
  ]'::jsonb
);

do $$
declare
  before_row public.customer_lifetime_contribution_profit%rowtype;
begin
  select * into before_row
  from public.customer_lifetime_contribution_profit
  where business_id = '25252525-2525-4252-8252-25252525a001'
    and cohort_month = '2026-01-01'::date;

  if not found or before_row.allocation_complete or before_row.lifetime_contribution_profit is not null then
    raise exception 'Task 25 must remain unavailable before complete explicit cost attribution';
  end if;
end;
$$;

select public.save_customer_cohort_cost_allocations(
  '25252525-2525-4252-8252-25252525a001',
  '2026-01-01'::date,
  '[
    {"cost_type":"acquisition","amount":"2500","attribution_method":"direct_actual","note":"Attributed acquisition cost"},
    {"cost_type":"variable_fulfillment","amount":"1000","attribution_method":"explicit_allocation","note":"Customer-linked fulfillment"},
    {"cost_type":"other_variable","amount":"500","attribution_method":"direct_actual","note":"Other variable cost"},
    {"cost_type":"payment_processing","amount":"300","attribution_method":"direct_actual","note":"Processor fees"}
  ]'::jsonb
);

do $$
declare
  result_row public.customer_lifetime_contribution_profit%rowtype;
begin
  select * into result_row
  from public.customer_lifetime_contribution_profit
  where business_id = '25252525-2525-4252-8252-25252525a001'
    and cohort_month = '2026-01-01'::date;

  if not result_row.allocation_complete
    or result_row.lifetime_net_cash <> 10000
    or result_row.acquisition_costs <> 2500
    or result_row.variable_fulfillment_costs <> 1000
    or result_row.other_variable_costs <> 500
    or result_row.payment_processing_costs <> 300
    or result_row.lifetime_contribution_profit <> 5700
    or result_row.lifetime_contribution_profit_per_customer <> 5700
    or result_row.lifetime_contribution_profit_text <> '5700'
    or not result_row.uses_explicit_allocation then
    raise exception 'Example K Lifetime Contribution Profit values are wrong';
  end if;
end;
$$;

begin
  perform public.save_customer_cohort_cost_allocations(
    '25252525-2525-4252-8252-25252525a001',
    '2026-01-01'::date,
    '[
      {"cost_type":"acquisition","amount":"1","attribution_method":"direct_actual"},
      {"cost_type":"variable_fulfillment","amount":"1","attribution_method":"direct_actual"},
      {"cost_type":"other_variable","amount":"1","attribution_method":"direct_actual"},
      {"cost_type":"overhead","amount":"4000","attribution_method":"direct_actual"}
    ]'::jsonb
  );
  raise exception 'Fixed overhead unexpectedly entered Lifetime Contribution Profit allocation';
exception when invalid_parameter_value then null;
end;
$$;

set local request.jwt.claims =
  '{"sub":"25252525-2525-4252-8252-252525252003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if not exists (
    select 1 from public.customer_lifetime_contribution_profit
    where business_id = '25252525-2525-4252-8252-25252525a001'
  ) then raise exception 'Authorized member cannot read Task 25 result'; end if;

  begin
    perform public.save_customer_cohort_cost_allocations(
      '25252525-2525-4252-8252-25252525a001',
      '2026-01-01'::date,
      '[
        {"cost_type":"acquisition","amount":"0","attribution_method":"direct_actual"},
        {"cost_type":"variable_fulfillment","amount":"0","attribution_method":"direct_actual"},
        {"cost_type":"other_variable","amount":"0","attribution_method":"direct_actual"},
        {"cost_type":"payment_processing","amount":"0","attribution_method":"direct_actual"}
      ]'::jsonb
    );
    raise exception 'Non-owner member unexpectedly changed Task 25 allocations';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local request.jwt.claims =
  '{"sub":"25252525-2525-4252-8252-252525252002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1 from public.customer_lifetime_contribution_profit
    where business_id = '25252525-2525-4252-8252-25252525a001'
  ) then raise exception 'Owner B can read Business A Task 25 result'; end if;
end;
$$;

set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform count(*) from public.customer_lifetime_contribution_profit;
    raise exception 'Anonymous user unexpectedly read Task 25 result';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.save_customer_cohort_cost_allocations(
      '25252525-2525-4252-8252-25252525a001',
      '2026-01-01'::date,
      '[]'::jsonb
    );
    raise exception 'Anonymous user unexpectedly executed Task 25 allocation RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
