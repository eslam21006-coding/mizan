-- B10 verifies the pre-existing atomic Monthly RPC as exercised by the Setup save adapter.
-- This fixture runs exclusively inside the disposable local _test database and rolls back.
begin;

insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
 ('b1000000-0000-4100-8100-000000000001', 'b10-owner@example.test', '{"role":"mentee"}', now(), now()),
 ('b1000000-0000-4100-8100-000000000002', 'b10-outsider@example.test', '{"role":"mentee"}', now(), now());

insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
values
 ('b1000000-0000-4100-8100-000000000010', 'B10 Save Business', 'USD', 'Africa/Cairo',
  'b1000000-0000-4100-8100-000000000001', 'b1000000-0000-4100-8100-000000000011'),
 ('b1000000-0000-4100-8100-000000000020', 'B10 Foreign Business', 'USD', 'Africa/Cairo',
  'b1000000-0000-4100-8100-000000000002', 'b1000000-0000-4100-8100-000000000021');

insert into public.revenue_streams (id, business_id, name, stream_type, creation_request_id)
values
 ('b1000000-0000-4100-8100-000000000101', 'b1000000-0000-4100-8100-000000000010', 'Course', 'front_end', 'b1000000-0000-4100-8100-000000000111'),
 ('b1000000-0000-4100-8100-000000000102', 'b1000000-0000-4100-8100-000000000010', 'VIP', 'backend', 'b1000000-0000-4100-8100-000000000112'),
 ('b1000000-0000-4100-8100-000000000201', 'b1000000-0000-4100-8100-000000000020', 'Foreign Source', 'front_end', 'b1000000-0000-4100-8100-000000000211');

insert into public.expense_items (id, business_id, name, category, cost_behavior, creation_request_id)
values
 ('b1000000-0000-4100-8100-000000000301', 'b1000000-0000-4100-8100-000000000010', 'Ads', 'acquisition', 'fixed_monthly', 'b1000000-0000-4100-8100-000000000311'),
 ('b1000000-0000-4100-8100-000000000302', 'b1000000-0000-4100-8100-000000000010', 'Coach', 'fulfillment', 'per_customer', 'b1000000-0000-4100-8100-000000000312'),
 ('b1000000-0000-4100-8100-000000000303', 'b1000000-0000-4100-8100-000000000010', 'Rent', 'overhead', 'fixed_monthly', 'b1000000-0000-4100-8100-000000000313'),
 ('b1000000-0000-4100-8100-000000000304', 'b1000000-0000-4100-8100-000000000010', 'Fees', 'financial', 'percentage_revenue', 'b1000000-0000-4100-8100-000000000314'),
 ('b1000000-0000-4100-8100-000000000401', 'b1000000-0000-4100-8100-000000000020', 'Foreign Cost', 'overhead', 'fixed_monthly', 'b1000000-0000-4100-8100-000000000411');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"b1000000-0000-4100-8100-000000000001","role":"authenticated","app_metadata":{"role":"mentee"}}';

-- A known complete month; second identical submission must be financially idempotent.
select public.save_monthly_actuals(
 'b1000000-0000-4100-8100-000000000010', '2099-01-01',
 10, 15, null, null, null,
 '[
  {"revenue_stream_id":"b1000000-0000-4100-8100-000000000101","gross_cash_collected":"10000","refunds":"500"},
  {"revenue_stream_id":"b1000000-0000-4100-8100-000000000102","gross_cash_collected":"4000","refunds":"0"}
 ]'::jsonb,
 '[
  {"expense_item_id":"b1000000-0000-4100-8100-000000000301","display_value":"2000","customer_count_basis":null},
  {"expense_item_id":"b1000000-0000-4100-8100-000000000302","display_value":"20","customer_count_basis":"total_paying_customers"},
  {"expense_item_id":"b1000000-0000-4100-8100-000000000303","display_value":"1000","customer_count_basis":null},
  {"expense_item_id":"b1000000-0000-4100-8100-000000000304","display_value":"3.5","customer_count_basis":null}
 ]'::jsonb
);

select public.save_monthly_actuals(
 'b1000000-0000-4100-8100-000000000010', '2099-01-01',
 10, 15, null, null, null,
 '[
  {"revenue_stream_id":"b1000000-0000-4100-8100-000000000101","gross_cash_collected":"10000","refunds":"500"},
  {"revenue_stream_id":"b1000000-0000-4100-8100-000000000102","gross_cash_collected":"4000","refunds":"0"}
 ]'::jsonb,
 '[
  {"expense_item_id":"b1000000-0000-4100-8100-000000000301","display_value":"2000","customer_count_basis":null},
  {"expense_item_id":"b1000000-0000-4100-8100-000000000302","display_value":"20","customer_count_basis":"total_paying_customers"},
  {"expense_item_id":"b1000000-0000-4100-8100-000000000303","display_value":"1000","customer_count_basis":null},
  {"expense_item_id":"b1000000-0000-4100-8100-000000000304","display_value":"3.5","customer_count_basis":null}
 ]'::jsonb
);

do $$
declare
 pid uuid;
 collected numeric;
 cost numeric;
begin
 select id into pid from public.monthly_periods
 where business_id='b1000000-0000-4100-8100-000000000010' and month_start='2099-01-01';
 if pid is null then raise exception 'B10 complete period was not saved'; end if;

 if (select count(*) from public.monthly_periods
     where business_id='b1000000-0000-4100-8100-000000000010' and month_start='2099-01-01') <> 1
    or (select count(*) from public.monthly_revenue_entries where monthly_period_id=pid) <> 2
    or (select count(*) from public.monthly_expense_entries where monthly_period_id=pid) <> 4 then
    raise exception 'B10 repeated saves duplicated financial records';
 end if;

 select sum(gross_cash_collected-refunds) into collected
 from public.monthly_revenue_entries where monthly_period_id=pid;
 select sum(
   case when e.cost_behavior_snapshot='per_customer' then e.input_value*15
        when e.cost_behavior_snapshot='percentage_revenue' then e.input_value*collected
        else e.input_value end
 ) into cost from public.monthly_expense_entries e where e.monthly_period_id=pid;
 if collected <> 13500 or cost <> 3772.5 or collected-cost <> 9727.5 then
   raise exception 'B10 persisted known-number financial result mismatch (%/%)',collected,cost;
 end if;
 if not exists(select 1 from public.monthly_expense_entries where monthly_period_id=pid
   and expense_item_id='b1000000-0000-4100-8100-000000000304' and input_value=0.035)
 then raise exception 'B10 percentage 3.5 must store as 0.035'; end if;
 if not exists(select 1 from public.monthly_periods where id=pid
   and unallocated_gross_cash_collected is null and unallocated_refunds is null)
 then raise exception 'B10 missing unallocated entries were converted into zeros'; end if;
end $$;

-- A partial month preserves NULLs and omits new, entirely untouched expenses.
select public.save_monthly_actuals(
 'b1000000-0000-4100-8100-000000000010','2099-03-01',
 null,null,null,null,null,
 '[{"revenue_stream_id":"b1000000-0000-4100-8100-000000000101","gross_cash_collected":"0","refunds":null}]'::jsonb,
 '[]'::jsonb
);

do $$
declare pid uuid;
begin
 select id into pid from public.monthly_periods
 where business_id='b1000000-0000-4100-8100-000000000010' and month_start='2099-03-01';
 if pid is null then raise exception 'B10 partial period missing'; end if;
 if not exists(select 1 from public.monthly_revenue_entries
   where monthly_period_id=pid and gross_cash_collected=0 and refunds is null)
 then raise exception 'B10 partial saved zero and missing refunds incorrectly'; end if;
 if exists(select 1 from public.monthly_expense_entries where monthly_period_id=pid)
 then raise exception 'B10 partial draft manufactured expense rows'; end if;
end $$;

-- The RPC must roll back a newly inserted period when an item belongs to another business.
do $$
declare blocked boolean := false;
begin
 begin
  perform public.save_monthly_actuals(
   'b1000000-0000-4100-8100-000000000010','2099-02-01',
   3,4,null,null,null,
   '[{"revenue_stream_id":"b1000000-0000-4100-8100-000000000201","gross_cash_collected":"100","refunds":"0"}]'::jsonb,
   '[]'::jsonb
  );
 exception when sqlstate '42501' then blocked := true;
 end;
 if not blocked then raise exception 'B10 accepted a foreign revenue source'; end if;
 if exists(select 1 from public.monthly_periods
   where business_id='b1000000-0000-4100-8100-000000000010' and month_start='2099-02-01')
 then raise exception 'B10 failed request left behind a partial period'; end if;
end $$;

-- Member/outsider may not mutate the owner's saved month by calling the RPC directly.
set local request.jwt.claims =
  '{"sub":"b1000000-0000-4100-8100-000000000002","role":"authenticated","app_metadata":{"role":"mentee"}}';

do $$
declare blocked boolean := false;
begin
 begin
  perform public.save_monthly_actuals(
   'b1000000-0000-4100-8100-000000000010','2099-01-01',
   999,999,null,null,null,
   '[]'::jsonb,'[]'::jsonb
  );
 exception when sqlstate '42501' then blocked := true;
 end;
 if not blocked then raise exception 'B10 outsider modified another business'; end if;
end $$;

reset role;
do $$
begin
 if not exists(select 1 from public.monthly_periods
    where business_id='b1000000-0000-4100-8100-000000000010'
      and month_start='2099-01-01' and new_customers=10 and total_paying_customers=15)
 then raise exception 'B10 unauthorized write mutated saved customer counts'; end if;
end $$;

rollback;
