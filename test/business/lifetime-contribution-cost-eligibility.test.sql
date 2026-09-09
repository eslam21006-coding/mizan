begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('68686868-6868-4686-8686-686868680001', 'lcp-eligibility-owner@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('68686868-6868-4686-8686-686868680002', 'lcp-eligibility-member@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('68686868-6868-4686-8686-686868680003', 'lcp-eligibility-outsider@example.test', '{"role":"mentee"}'::jsonb, now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
  ('68686868-6868-4686-8686-68686868a001', 'Lifetime Eligibility A', 'USD', 'Africa/Cairo', '68686868-6868-4686-8686-686868680001', '68686868-6868-4686-8686-68686868c001'),
  ('68686868-6868-4686-8686-68686868b002', 'Lifetime Eligibility B', 'USD', 'Africa/Cairo', '68686868-6868-4686-8686-686868680003', '68686868-6868-4686-8686-68686868c002');

insert into public.business_memberships (business_id, user_id, membership_role)
values ('68686868-6868-4686-8686-68686868a001', '68686868-6868-4686-8686-686868680002', 'member');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"68686868-6868-4686-8686-686868680001","role":"authenticated","app_metadata":{"role":"mentee"}}';

select public.create_customer_transaction_source('68686868-6868-4686-8686-68686868a001', 'stripe');
select public.import_customer_transactions(
  '68686868-6868-4686-8686-68686868a001',
  'stripe',
  '[
    {"row_number":1,"transaction_id":"aug-cash","import_row_token":"68686868-6868-4686-8686-68686868f001","customer_email":"august@example.com","transaction_date":"2026-08-05T10:00:00Z","amount_collected":"6829","transaction_type":"collection","normalized_outcome":"successful","currency":"USD"}
  ]'::jsonb
);

-- Simulate a positive allocation saved before the eligibility migration. Forward migration
-- deliberately keeps it but defaults its eligibility confirmation to false.
reset role;
insert into public.customer_cohort_cost_allocations (
  business_id,
  cohort_month,
  cost_type,
  amount,
  attribution_method,
  note,
  created_by_user_id,
  updated_by_user_id
)
values
  ('68686868-6868-4686-8686-68686868a001', '2026-08-01', 'acquisition', 2580, 'direct_actual', 'Meta Ads', '68686868-6868-4686-8686-686868680001', '68686868-6868-4686-8686-686868680001'),
  ('68686868-6868-4686-8686-68686868a001', '2026-08-01', 'variable_fulfillment', 6000, 'direct_actual', 'رواتب', '68686868-6868-4686-8686-686868680001', '68686868-6868-4686-8686-686868680001'),
  ('68686868-6868-4686-8686-68686868a001', '2026-08-01', 'other_variable', 0, 'direct_actual', null, '68686868-6868-4686-8686-686868680001', '68686868-6868-4686-8686-686868680001'),
  ('68686868-6868-4686-8686-68686868a001', '2026-08-01', 'payment_processing', 428.41, 'direct_actual', 'Stripe', '68686868-6868-4686-8686-686868680001', '68686868-6868-4686-8686-686868680001');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"68686868-6868-4686-8686-686868680001","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare
  result_row record;
begin
  select allocation_complete, lifetime_contribution_profit_text
  into result_row
  from public.customer_lifetime_contribution_profit
  where business_id = '68686868-6868-4686-8686-68686868a001'
    and cohort_month = '2026-08-01'::date
  limit 1;

  if result_row.allocation_complete or result_row.lifetime_contribution_profit_text is not null then
    raise exception 'Unreviewed positive legacy costs unexpectedly produced an authoritative Lifetime Contribution Profit';
  end if;

  if not exists (
    select 1
    from public.customer_cohort_cost_allocation_display
    where business_id = '68686868-6868-4686-8686-68686868a001'
      and cohort_month = '2026-08-01'::date
      and amount > 0
      and eligibility_confirmed = false
  ) then
    raise exception 'Legacy positive allocations were not exposed as requiring eligibility review';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.save_customer_cohort_cost_allocations(
      '68686868-6868-4686-8686-68686868a001',
      '2026-08-01'::date,
      '[
        {"cost_type":"acquisition","amount":"2580","attribution_method":"direct_actual","note":"Meta Ads","eligibility_confirmed":true},
        {"cost_type":"variable_fulfillment","amount":"6000","attribution_method":"direct_actual","note":"رواتب","eligibility_confirmed":false},
        {"cost_type":"other_variable","amount":"0","attribution_method":"direct_actual","eligibility_confirmed":false},
        {"cost_type":"payment_processing","amount":"428.41","attribution_method":"direct_actual","note":"Stripe","eligibility_confirmed":true}
      ]'::jsonb
    );
    raise exception 'Positive unconfirmed lifetime cost unexpectedly saved';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

select public.save_customer_cohort_cost_allocations(
  '68686868-6868-4686-8686-68686868a001',
  '2026-08-01'::date,
  '[
    {"cost_type":"acquisition","amount":"2580","attribution_method":"direct_actual","note":"Meta Ads","eligibility_confirmed":true},
    {"cost_type":"variable_fulfillment","amount":"6000","attribution_method":"explicit_allocation","note":"Reviewed variable fulfillment example","eligibility_confirmed":true},
    {"cost_type":"other_variable","amount":"0","attribution_method":"direct_actual","eligibility_confirmed":false},
    {"cost_type":"payment_processing","amount":"428.41","attribution_method":"direct_actual","note":"Stripe","eligibility_confirmed":true}
  ]'::jsonb
);

do $$
declare
  result_row record;
begin
  select
    allocation_complete,
    lifetime_net_cash,
    acquisition_costs,
    variable_fulfillment_costs,
    other_variable_costs,
    payment_processing_costs,
    lifetime_contribution_profit,
    lifetime_contribution_profit_text
  into result_row
  from public.customer_lifetime_contribution_profit
  where business_id = '68686868-6868-4686-8686-68686868a001'
    and cohort_month = '2026-08-01'::date
  limit 1;

  if not result_row.allocation_complete
    or result_row.lifetime_net_cash <> 6829
    or result_row.acquisition_costs <> 2580
    or result_row.variable_fulfillment_costs <> 6000
    or result_row.other_variable_costs <> 0
    or result_row.payment_processing_costs <> 428.41
    or result_row.lifetime_contribution_profit <> -2179.41
    or result_row.lifetime_contribution_profit_text <> '-2179.41' then
    raise exception 'Screenshot-case lifetime profitability arithmetic is wrong';
  end if;
end;
$$;

set local request.jwt.claims =
  '{"sub":"68686868-6868-4686-8686-686868680002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if not exists (
    select 1 from public.customer_lifetime_contribution_profit
    where business_id = '68686868-6868-4686-8686-68686868a001'
  ) then
    raise exception 'Read-only member cannot read reviewed lifetime profitability';
  end if;

  begin
    perform public.save_customer_cohort_cost_allocations(
      '68686868-6868-4686-8686-68686868a001',
      '2026-08-01'::date,
      '[
        {"cost_type":"acquisition","amount":"0","attribution_method":"direct_actual","eligibility_confirmed":false},
        {"cost_type":"variable_fulfillment","amount":"0","attribution_method":"direct_actual","eligibility_confirmed":false},
        {"cost_type":"other_variable","amount":"0","attribution_method":"direct_actual","eligibility_confirmed":false},
        {"cost_type":"payment_processing","amount":"0","attribution_method":"direct_actual","eligibility_confirmed":false}
      ]'::jsonb
    );
    raise exception 'Read-only member unexpectedly changed reviewed lifetime costs';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local request.jwt.claims =
  '{"sub":"68686868-6868-4686-8686-686868680003","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
begin
  if exists (
    select 1 from public.customer_lifetime_contribution_profit
    where business_id = '68686868-6868-4686-8686-68686868a001'
  ) then
    raise exception 'Unrelated mentee can read another business lifetime profitability';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claims = '{}';

do $$
begin
  begin
    perform public.save_customer_cohort_cost_allocations(
      '68686868-6868-4686-8686-68686868a001',
      '2026-08-01'::date,
      '[]'::jsonb
    );
    raise exception 'Anonymous user unexpectedly executed reviewed lifetime cost RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
