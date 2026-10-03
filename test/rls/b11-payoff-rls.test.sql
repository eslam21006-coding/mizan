-- B11.2 verifies the existing business-scoped SELECT policies used by its GET-only payoff route.
-- Run only on CI's disposable local _test database; all fixtures roll back.
begin;

insert into auth.users (id,email,raw_app_meta_data,created_at,updated_at)
values
 ('b1120000-0000-4112-8112-000000000001','b11-payoff-owner-a@example.test','{"role":"mentee"}',now(),now()),
 ('b1120000-0000-4112-8112-000000000002','b11-payoff-owner-b@example.test','{"role":"mentee"}',now(),now()),
 ('b1120000-0000-4112-8112-000000000003','b11-payoff-viewer@example.test','{"role":"mentee"}',now(),now()),
 ('b1120000-0000-4112-8112-000000000004','b11-payoff-admin@example.test','{"role":"admin"}',now(),now());

insert into public.businesses (id,name,base_currency,timezone,owner_user_id,creation_request_id)
values
 ('b1120000-0000-4112-8112-000000000010','Payoff Business A','USD','Africa/Cairo',
  'b1120000-0000-4112-8112-000000000001','b1120000-0000-4112-8112-000000000011'),
 ('b1120000-0000-4112-8112-000000000020','Payoff Business B','AED','Asia/Dubai',
  'b1120000-0000-4112-8112-000000000002','b1120000-0000-4112-8112-000000000021');

insert into public.business_memberships (business_id,user_id,membership_role)
values ('b1120000-0000-4112-8112-000000000010','b1120000-0000-4112-8112-000000000003','member');

insert into public.revenue_streams (id,business_id,name,stream_type,creation_request_id)
values
 ('b1120000-0000-4112-8112-000000000101','b1120000-0000-4112-8112-000000000010',
  'Own course','front_end','b1120000-0000-4112-8112-000000000111'),
 ('b1120000-0000-4112-8112-000000000201','b1120000-0000-4112-8112-000000000020',
  'Foreign course','front_end','b1120000-0000-4112-8112-000000000211');

insert into public.expense_items (id,business_id,name,category,cost_behavior,creation_request_id)
values
 ('b1120000-0000-4112-8112-000000000301','b1120000-0000-4112-8112-000000000010',
  'Own overhead','overhead','fixed_monthly','b1120000-0000-4112-8112-000000000311'),
 ('b1120000-0000-4112-8112-000000000401','b1120000-0000-4112-8112-000000000020',
  'Foreign overhead','overhead','fixed_monthly','b1120000-0000-4112-8112-000000000411');

insert into public.monthly_periods (id,business_id,month_start,new_customers,total_paying_customers)
values
 ('b1120000-0000-4112-8112-000000000501','b1120000-0000-4112-8112-000000000010',
  '2026-08-01',5,6),
 ('b1120000-0000-4112-8112-000000000502','b1120000-0000-4112-8112-000000000020',
  '2026-08-01',8,10);

insert into public.monthly_revenue_entries
 (business_id,monthly_period_id,revenue_stream_id,stream_name_snapshot,stream_type_snapshot,gross_cash_collected,refunds)
values
 ('b1120000-0000-4112-8112-000000000010','b1120000-0000-4112-8112-000000000501',
  'b1120000-0000-4112-8112-000000000101','Own course','front_end',1000,0),
 ('b1120000-0000-4112-8112-000000000020','b1120000-0000-4112-8112-000000000502',
  'b1120000-0000-4112-8112-000000000201','Foreign course','front_end',99999,0);

insert into public.monthly_expense_entries
 (business_id,monthly_period_id,expense_item_id,expense_name_snapshot,category_snapshot,cost_behavior_snapshot,input_value,customer_count_basis)
values
 ('b1120000-0000-4112-8112-000000000010','b1120000-0000-4112-8112-000000000501',
  'b1120000-0000-4112-8112-000000000301','Own overhead','overhead','fixed_monthly',100,null),
 ('b1120000-0000-4112-8112-000000000020','b1120000-0000-4112-8112-000000000502',
  'b1120000-0000-4112-8112-000000000401','Foreign overhead','overhead','fixed_monthly',9000,null);

set local role authenticated;
set local request.jwt.claims =
 '{"sub":"b1120000-0000-4112-8112-000000000001","role":"authenticated","app_metadata":{"role":"mentee"}}';
do $$
begin
 if (select count(*) from public.businesses) <> 1 or
    (select count(*) from public.monthly_periods) <> 1 or
    (select count(*) from public.monthly_revenue_entries) <> 1 or
    (select count(*) from public.monthly_expense_entries) <> 1 then
   raise exception 'B11 payoff owner could read foreign business or failed own read';
 end if;
 if exists(select 1 from public.monthly_revenue_entries where gross_cash_collected=99999) or
    exists(select 1 from public.monthly_expense_entries where input_value=9000) then
   raise exception 'B11 payoff owner saw foreign financial details';
 end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
 '{"sub":"b1120000-0000-4112-8112-000000000003","role":"authenticated","app_metadata":{"role":"mentee"}}';
do $$
begin
 if (select count(*) from public.businesses) <> 1 or
    (select count(*) from public.monthly_periods) <> 1 or
    (select count(*) from public.monthly_revenue_entries) <> 1 or
    (select count(*) from public.monthly_expense_entries) <> 1 then
   raise exception 'B11 payoff read-only member could not read own business or could read foreign data';
 end if;
 if exists (select 1 from public.monthly_revenue_entries where gross_cash_collected=99999) then
   raise exception 'B11 payoff member saw foreign financial details';
 end if;
 if has_table_privilege('authenticated','public.monthly_periods','INSERT') or
    has_table_privilege('authenticated','public.monthly_revenue_entries','UPDATE') then
   raise exception 'B11 payoff member has direct financial mutation privileges';
 end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
 '{"sub":"b1120000-0000-4112-8112-000000000002","role":"authenticated","app_metadata":{"role":"mentee"}}';
do $$
begin
 if (select count(*) from public.monthly_periods) <> 1 or
    (select count(*) from public.monthly_revenue_entries) <> 1 or
    (select count(*) from public.monthly_expense_entries) <> 1 or
    exists (select 1 from public.businesses where id='b1120000-0000-4112-8112-000000000010') then
   raise exception 'B11 payoff unrelated mentee accessed owner A records';
 end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
 '{"sub":"b1120000-0000-4112-8112-000000000004","role":"authenticated","app_metadata":{"role":"admin"}}';
do $$
begin
 if (select count(*) from public.businesses) <> 2 or
    (select count(*) from public.monthly_periods) <> 2 or
    (select count(*) from public.monthly_revenue_entries) <> 2 or
    (select count(*) from public.monthly_expense_entries) <> 2 then
   raise exception 'B11 payoff admin cannot read both owned financial periods';
 end if;
end $$;

reset role;
do $$
begin
 if has_table_privilege('anon','public.monthly_periods','SELECT') or
    has_table_privilege('anon','public.monthly_revenue_entries','SELECT') or
    has_table_privilege('anon','public.monthly_expense_entries','SELECT') then
   raise exception 'B11 payoff anonymous role can read saved financial data';
 end if;
end $$;

rollback;
