create or replace view public.customer_economics_monthly_financial_basis
with (security_invoker = true, security_barrier = true)
as
with revenue_rollup as (
  select
    period.id as monthly_period_id,
    period.business_id,
    period.month_start as activity_month,
    period.new_customers,
    period.total_paying_customers,
    period.unallocated_gross_cash_collected,
    period.unallocated_refunds,
    count(revenue.id) filter (where revenue.gross_cash_collected is null) as missing_gross_entries,
    count(revenue.id) filter (where revenue.refunds is null) as missing_refund_entries,
    coalesce(sum(revenue.gross_cash_collected), 0::numeric) as stream_gross_cash_collected,
    coalesce(sum(revenue.refunds), 0::numeric) as stream_refunds
  from public.monthly_periods as period
  left join public.monthly_revenue_entries as revenue
    on revenue.monthly_period_id = period.id
   and revenue.business_id = period.business_id
  group by
    period.id,
    period.business_id,
    period.month_start,
    period.new_customers,
    period.total_paying_customers,
    period.unallocated_gross_cash_collected,
    period.unallocated_refunds
)
select
  revenue_rollup.monthly_period_id,
  revenue_rollup.business_id,
  revenue_rollup.activity_month,
  revenue_rollup.new_customers,
  revenue_rollup.total_paying_customers,
  case
    when revenue_rollup.unallocated_gross_cash_collected is null
      or revenue_rollup.missing_gross_entries > 0 then null
    else revenue_rollup.stream_gross_cash_collected + revenue_rollup.unallocated_gross_cash_collected
  end as gross_cash_collected,
  case
    when revenue_rollup.unallocated_refunds is null
      or revenue_rollup.missing_refund_entries > 0 then null
    else revenue_rollup.stream_refunds + revenue_rollup.unallocated_refunds
  end as refunds,
  case
    when revenue_rollup.unallocated_gross_cash_collected is null
      or revenue_rollup.unallocated_refunds is null
      or revenue_rollup.missing_gross_entries > 0
      or revenue_rollup.missing_refund_entries > 0 then null
    else
      revenue_rollup.stream_gross_cash_collected
      + revenue_rollup.unallocated_gross_cash_collected
      - revenue_rollup.stream_refunds
      - revenue_rollup.unallocated_refunds
  end as net_cash_collected,
  business.base_currency as currency
from revenue_rollup
join public.businesses as business
  on business.id = revenue_rollup.business_id;

revoke all on public.customer_economics_monthly_financial_basis from public;
revoke all on public.customer_economics_monthly_financial_basis from anon;
revoke all on public.customer_economics_monthly_financial_basis from authenticated;
grant select on public.customer_economics_monthly_financial_basis to authenticated;
grant select on public.customer_economics_monthly_financial_basis to service_role;

comment on view public.customer_economics_monthly_financial_basis is
  'Task 2 read-only Customer Economics projection of the existing Monthly Business Actuals inputs. It preserves missing values and reproduces the monthly financial engine net-cash basis without treating transaction cash as additional business revenue.';

create or replace view public.customer_economics_authoritative_cost_pools
with (security_invoker = true, security_barrier = true)
as
select
  foundation.authoritative_source_id,
  foundation.authoritative_source_type,
  foundation.business_id,
  foundation.activity_month,
  foundation.monthly_period_id,
  foundation.expense_item_id,
  foundation.expense_name_snapshot,
  foundation.category_snapshot,
  foundation.cost_behavior_snapshot,
  foundation.customer_count_basis_snapshot,
  foundation.cost_eligibility,
  foundation.default_allocation_driver,
  foundation.eligibility_reason,
  case
    when foundation.calculation_input_value is null then null
    when foundation.cost_behavior_snapshot = 'fixed_monthly' then foundation.calculation_input_value
    when foundation.cost_behavior_snapshot = 'per_customer'
      and foundation.customer_count_basis_snapshot = 'new_customers'
      and financial_basis.new_customers is not null
      then foundation.calculation_input_value * financial_basis.new_customers::numeric
    when foundation.cost_behavior_snapshot = 'per_customer'
      and foundation.customer_count_basis_snapshot = 'total_paying_customers'
      and financial_basis.total_paying_customers is not null
      then foundation.calculation_input_value * financial_basis.total_paying_customers::numeric
    when foundation.cost_behavior_snapshot = 'percentage_revenue'
      and financial_basis.net_cash_collected is not null
      then foundation.calculation_input_value * greatest(financial_basis.net_cash_collected, 0::numeric)
    else null
  end as authoritative_amount,
  case
    when foundation.calculation_input_value is null then 'missing'
    when foundation.cost_behavior_snapshot = 'per_customer'
      and foundation.customer_count_basis_snapshot = 'new_customers'
      and financial_basis.new_customers is null then 'missing'
    when foundation.cost_behavior_snapshot = 'per_customer'
      and foundation.customer_count_basis_snapshot = 'total_paying_customers'
      and financial_basis.total_paying_customers is null then 'missing'
    when foundation.cost_behavior_snapshot = 'percentage_revenue'
      and financial_basis.net_cash_collected is null then 'missing'
    else 'actual'
  end as authoritative_amount_state,
  financial_basis.currency
from public.customer_economics_expense_foundation as foundation
join public.customer_economics_monthly_financial_basis as financial_basis
  on financial_basis.monthly_period_id = foundation.monthly_period_id
 and financial_basis.business_id = foundation.business_id;

revoke all on public.customer_economics_authoritative_cost_pools from public;
revoke all on public.customer_economics_authoritative_cost_pools from anon;
revoke all on public.customer_economics_authoritative_cost_pools from authenticated;
grant select on public.customer_economics_authoritative_cost_pools to authenticated;
grant select on public.customer_economics_authoritative_cost_pools to service_role;

comment on view public.customer_economics_authoritative_cost_pools is
  'Task 2 authoritative eligible/excluded cost pools. Amounts are derived only from the existing monthly expense inputs using the same Fixed Monthly, Per Customer, and Percentage of Revenue semantics as the business financial engine.';

create or replace view public.customer_economics_transaction_monthly_totals
with (security_invoker = true, security_barrier = true)
as
select
  transaction.business_id,
  pg_catalog.date_trunc('month', transaction.transaction_date::timestamp)::date as activity_month,
  coalesce(sum(transaction.amount_collected) filter (
    where transaction.normalized_outcome = 'successful'
      and transaction.transaction_type = 'collection'
  ), 0::numeric) as gross_cash_collected,
  coalesce(sum(transaction.amount_collected) filter (
    where transaction.normalized_outcome = 'successful'
      and transaction.transaction_type = 'refund'
  ), 0::numeric) as refunds,
  coalesce(sum(transaction.amount_collected) filter (
    where transaction.normalized_outcome = 'successful'
      and transaction.transaction_type = 'collection'
      and transaction.amount_collected > 0
  ), 0::numeric) as positive_collected_cash
from public.customer_transactions as transaction
group by
  transaction.business_id,
  pg_catalog.date_trunc('month', transaction.transaction_date::timestamp)::date;

revoke all on public.customer_economics_transaction_monthly_totals from public;
revoke all on public.customer_economics_transaction_monthly_totals from anon;
revoke all on public.customer_economics_transaction_monthly_totals from authenticated;
grant select on public.customer_economics_transaction_monthly_totals to authenticated;
grant select on public.customer_economics_transaction_monthly_totals to service_role;

create or replace view public.customer_economics_revenue_coverage
with (security_invoker = true, security_barrier = true)
as
select
  financial_basis.business_id,
  financial_basis.activity_month,
  financial_basis.net_cash_collected as business_net_cash,
  case
    when financial_basis.net_cash_collected is null then null
    else coalesce(transaction_totals.gross_cash_collected, 0::numeric)
      - coalesce(transaction_totals.refunds, 0::numeric)
  end as transaction_net_cash,
  case
    when financial_basis.net_cash_collected is null then null
    else abs(
      financial_basis.net_cash_collected
      - (
        coalesce(transaction_totals.gross_cash_collected, 0::numeric)
        - coalesce(transaction_totals.refunds, 0::numeric)
      )
    )
  end as coverage_difference,
  case
    when financial_basis.net_cash_collected is null then null
    else greatest(1::numeric, abs(financial_basis.net_cash_collected) * 0.001::numeric)
  end as coverage_tolerance,
  case
    when financial_basis.net_cash_collected is null then true
    else abs(
      financial_basis.net_cash_collected
      - (
        coalesce(transaction_totals.gross_cash_collected, 0::numeric)
        - coalesce(transaction_totals.refunds, 0::numeric)
      )
    ) > greatest(1::numeric, abs(financial_basis.net_cash_collected) * 0.001::numeric)
  end as blocking,
  case
    when financial_basis.net_cash_collected is null then 'BUSINESS_NET_CASH_MISSING'
    when abs(
      financial_basis.net_cash_collected
      - (
        coalesce(transaction_totals.gross_cash_collected, 0::numeric)
        - coalesce(transaction_totals.refunds, 0::numeric)
      )
    ) > greatest(1::numeric, abs(financial_basis.net_cash_collected) * 0.001::numeric)
      then 'REVENUE_COVERAGE_MISMATCH'
    else 'COVERED'
  end as coverage_state,
  financial_basis.currency
from public.customer_economics_monthly_financial_basis as financial_basis
left join public.customer_economics_transaction_monthly_totals as transaction_totals
  on transaction_totals.business_id = financial_basis.business_id
 and transaction_totals.activity_month = financial_basis.activity_month;

revoke all on public.customer_economics_revenue_coverage from public;
revoke all on public.customer_economics_revenue_coverage from anon;
revoke all on public.customer_economics_revenue_coverage from authenticated;
grant select on public.customer_economics_revenue_coverage to authenticated;
grant select on public.customer_economics_revenue_coverage to service_role;

comment on view public.customer_economics_revenue_coverage is
  'Task 2 coverage check only. Business Net Cash and transaction-derived customer Net Cash are compared, never added. Blocking tolerance is max(1 base-currency unit, 0.1 percent of absolute Business Net Cash).';

create or replace view public.customer_economics_activity_evidence
with (security_invoker = true, security_barrier = true)
as
with new_customers as (
  select
    cohort.business_id,
    cohort.cohort_month as activity_month,
    cohort.cohort_month,
    'new_customers'::text as allocation_driver,
    count(*)::numeric as allocation_weight
  from public.customer_acquisition_cohorts as cohort
  group by cohort.business_id, cohort.cohort_month
),
positive_activity as (
  select
    cohort.business_id,
    pg_catalog.date_trunc('month', transaction.transaction_date::timestamp)::date as activity_month,
    cohort.cohort_month,
    count(distinct transaction.customer_email)::numeric as paying_customer_count,
    sum(transaction.amount_collected)::numeric as positive_collected_cash
  from public.customer_acquisition_cohorts as cohort
  join public.customer_transactions as transaction
    on transaction.business_id = cohort.business_id
   and transaction.customer_email = cohort.customer_email
  where transaction.normalized_outcome = 'successful'
    and transaction.transaction_type = 'collection'
    and transaction.amount_collected > 0
  group by
    cohort.business_id,
    pg_catalog.date_trunc('month', transaction.transaction_date::timestamp)::date,
    cohort.cohort_month
),
paying_customers as (
  select
    positive_activity.business_id,
    positive_activity.activity_month,
    positive_activity.cohort_month,
    'paying_customers'::text as allocation_driver,
    positive_activity.paying_customer_count as allocation_weight
  from positive_activity
  where positive_activity.paying_customer_count > 0
),
positive_cash as (
  select
    positive_activity.business_id,
    positive_activity.activity_month,
    positive_activity.cohort_month,
    'positive_collected_cash'::text as allocation_driver,
    positive_activity.positive_collected_cash as allocation_weight
  from positive_activity
  where positive_activity.positive_collected_cash > 0
)
select * from new_customers
union all
select * from paying_customers
union all
select * from positive_cash;

revoke all on public.customer_economics_activity_evidence from public;
revoke all on public.customer_economics_activity_evidence from anon;
revoke all on public.customer_economics_activity_evidence from authenticated;
grant select on public.customer_economics_activity_evidence to authenticated;
grant select on public.customer_economics_activity_evidence to service_role;

comment on view public.customer_economics_activity_evidence is
  'Task 2 observable V1 allocation evidence at activity-month x first-purchase-month grain. Paying Customers are distinct successful positive payers; repeat transactions do not multiply the count; refund-only activity does not create a payer.';

create or replace view public.customer_economics_cost_pool_plan
with (security_invoker = true, security_barrier = true)
as
with evidence_totals as (
  select
    evidence.business_id,
    evidence.activity_month,
    evidence.allocation_driver,
    sum(evidence.allocation_weight) as total_weight
  from public.customer_economics_activity_evidence as evidence
  group by evidence.business_id, evidence.activity_month, evidence.allocation_driver
),
source_counts as (
  select
    pool.authoritative_source_type,
    pool.authoritative_source_id,
    count(*)::bigint as source_count
  from public.customer_economics_authoritative_cost_pools as pool
  group by pool.authoritative_source_type, pool.authoritative_source_id
)
select
  pool.*,
  coalesce(history.is_complete, false) as transaction_history_complete,
  coalesce(source_counts.source_count, 0) as authoritative_source_count,
  evidence_totals.total_weight,
  coverage.coverage_state,
  coverage.blocking as revenue_coverage_blocking,
  case
    when pool.cost_eligibility = 'excluded' then false
    when pool.authoritative_amount is null then false
    when pool.authoritative_amount = 0 then false
    when coalesce(source_counts.source_count, 0) <> 1 then false
    when not coalesce(history.is_complete, false) then false
    when pool.default_allocation_driver = 'none' then false
    when pool.default_allocation_driver = 'positive_collected_cash'
      and coalesce(coverage.blocking, true) then false
    when coalesce(evidence_totals.total_weight, 0::numeric) <= 0 then false
    else true
  end as can_allocate,
  case
    when pool.cost_eligibility = 'excluded' then 'excluded'
    when pool.authoritative_amount is null then 'incomplete'
    when pool.authoritative_amount = 0 then 'actual'
    when coalesce(source_counts.source_count, 0) <> 1 then 'incomplete'
    when not coalesce(history.is_complete, false) then 'incomplete'
    when pool.default_allocation_driver = 'none' then 'incomplete'
    when pool.default_allocation_driver = 'positive_collected_cash'
      and coalesce(coverage.blocking, true) then 'incomplete'
    when coalesce(evidence_totals.total_weight, 0::numeric) <= 0 then 'incomplete'
    else 'estimated'
  end as allocation_quality_state,
  case
    when pool.cost_eligibility = 'excluded' then 'EXCLUDED_COST'
    when pool.authoritative_amount is null then 'MISSING_ELIGIBLE_COST'
    when pool.authoritative_amount = 0 then null
    when coalesce(source_counts.source_count, 0) <> 1 then 'DUPLICATE_COST_SOURCE'
    when not coalesce(history.is_complete, false) then 'INCOMPLETE_TRANSACTION_HISTORY'
    when pool.default_allocation_driver = 'none' then 'UNSUPPORTED_ALLOCATION_BASIS'
    when pool.default_allocation_driver = 'positive_collected_cash'
      and coalesce(coverage.blocking, true) then 'REVENUE_COVERAGE_MISMATCH'
    when pool.default_allocation_driver = 'new_customers'
      and coalesce(evidence_totals.total_weight, 0::numeric) <= 0 then 'NO_NEW_CUSTOMERS'
    when pool.default_allocation_driver = 'paying_customers'
      and coalesce(evidence_totals.total_weight, 0::numeric) <= 0 then 'NO_PAYING_CUSTOMERS'
    when pool.default_allocation_driver = 'positive_collected_cash'
      and coalesce(evidence_totals.total_weight, 0::numeric) <= 0 then 'NO_POSITIVE_COLLECTED_CASH'
    else null
  end as allocation_exception_reason,
  case
    when pool.cost_eligibility = 'excluded' then 0::numeric
    when pool.authoritative_amount is null then null
    when pool.authoritative_amount = 0 then 0::numeric
    when coalesce(source_counts.source_count, 0) <> 1 then pool.authoritative_amount
    when not coalesce(history.is_complete, false) then pool.authoritative_amount
    when pool.default_allocation_driver = 'none' then pool.authoritative_amount
    when pool.default_allocation_driver = 'positive_collected_cash'
      and coalesce(coverage.blocking, true) then pool.authoritative_amount
    when coalesce(evidence_totals.total_weight, 0::numeric) <= 0 then pool.authoritative_amount
    else 0::numeric
  end as unallocated_amount
from public.customer_economics_authoritative_cost_pools as pool
left join public.business_transaction_history_status as history
  on history.business_id = pool.business_id
left join source_counts
  on source_counts.authoritative_source_type = pool.authoritative_source_type
 and source_counts.authoritative_source_id = pool.authoritative_source_id
left join evidence_totals
  on evidence_totals.business_id = pool.business_id
 and evidence_totals.activity_month = pool.activity_month
 and evidence_totals.allocation_driver = pool.default_allocation_driver
left join public.customer_economics_revenue_coverage as coverage
  on coverage.business_id = pool.business_id
 and coverage.activity_month = pool.activity_month;

revoke all on public.customer_economics_cost_pool_plan from public;
revoke all on public.customer_economics_cost_pool_plan from anon;
revoke all on public.customer_economics_cost_pool_plan from authenticated;
grant select on public.customer_economics_cost_pool_plan to authenticated;
grant select on public.customer_economics_cost_pool_plan to service_role;

create or replace view public.customer_economics_cost_allocations
with (security_invoker = true, security_barrier = true)
as
with candidates as (
  select
    plan.authoritative_source_id,
    plan.authoritative_source_type,
    plan.business_id,
    plan.activity_month,
    plan.expense_item_id,
    plan.expense_name_snapshot,
    plan.category_snapshot,
    plan.default_allocation_driver,
    plan.authoritative_amount,
    plan.currency,
    evidence.cohort_month,
    evidence.allocation_weight,
    plan.total_weight,
    row_number() over (
      partition by plan.authoritative_source_type, plan.authoritative_source_id
      order by evidence.cohort_month
    ) as allocation_rank,
    count(*) over (
      partition by plan.authoritative_source_type, plan.authoritative_source_id
    ) as allocation_count,
    plan.authoritative_amount * evidence.allocation_weight / plan.total_weight as raw_allocation_amount
  from public.customer_economics_cost_pool_plan as plan
  join public.customer_economics_activity_evidence as evidence
    on evidence.business_id = plan.business_id
   and evidence.activity_month = plan.activity_month
   and evidence.allocation_driver = plan.default_allocation_driver
  where plan.can_allocate
    and plan.authoritative_amount > 0
),
ranked as (
  select
    candidates.*,
    sum(
      case
        when candidates.allocation_rank < candidates.allocation_count
          then candidates.raw_allocation_amount
        else 0::numeric
      end
    ) over (
      partition by candidates.authoritative_source_type, candidates.authoritative_source_id
    ) as prior_allocated_amount
  from candidates
)
select
  ranked.authoritative_source_id,
  ranked.authoritative_source_type,
  ranked.business_id,
  ranked.activity_month,
  ranked.cohort_month,
  ranked.expense_item_id,
  ranked.expense_name_snapshot,
  ranked.category_snapshot,
  ranked.default_allocation_driver as allocation_driver,
  'deterministic_estimate'::text as allocation_provenance,
  ranked.allocation_weight,
  ranked.total_weight,
  case
    when ranked.allocation_rank = ranked.allocation_count
      then ranked.authoritative_amount - ranked.prior_allocated_amount
    else ranked.raw_allocation_amount
  end as allocated_amount,
  ranked.currency
from ranked;

revoke all on public.customer_economics_cost_allocations from public;
revoke all on public.customer_economics_cost_allocations from anon;
revoke all on public.customer_economics_cost_allocations from authenticated;
grant select on public.customer_economics_cost_allocations to authenticated;
grant select on public.customer_economics_cost_allocations to service_role;

comment on view public.customer_economics_cost_allocations is
  'Task 2 deterministic automatic cost distribution at authoritative cost-pool x activity-month x first-purchase-month grain. The final group receives the exact residual so PostgreSQL numeric division cannot cause cost-pool drift.';

create or replace view public.customer_economics_cost_pool_reconciliation
with (security_invoker = true, security_barrier = true)
as
with allocated as (
  select
    allocation.authoritative_source_type,
    allocation.authoritative_source_id,
    sum(allocation.allocated_amount) as allocated_amount
  from public.customer_economics_cost_allocations as allocation
  group by allocation.authoritative_source_type, allocation.authoritative_source_id
)
select
  plan.authoritative_source_id,
  plan.authoritative_source_type,
  plan.business_id,
  plan.activity_month,
  plan.expense_item_id,
  plan.expense_name_snapshot,
  plan.category_snapshot,
  plan.cost_eligibility,
  plan.default_allocation_driver,
  plan.authoritative_amount,
  case
    when plan.authoritative_amount is null then null
    else coalesce(allocated.allocated_amount, 0::numeric)
  end as allocated_amount,
  plan.unallocated_amount,
  case
    when plan.cost_eligibility = 'excluded' then null
    when plan.authoritative_amount is null or plan.unallocated_amount is null then null
    else
      plan.authoritative_amount
      - coalesce(allocated.allocated_amount, 0::numeric)
      - plan.unallocated_amount
  end as reconciliation_difference,
  case
    when plan.cost_eligibility = 'excluded' then null
    when plan.authoritative_amount is null or plan.unallocated_amount is null then null
    else
      plan.authoritative_amount
      = coalesce(allocated.allocated_amount, 0::numeric) + plan.unallocated_amount
  end as reconciles,
  plan.allocation_quality_state,
  plan.allocation_exception_reason,
  plan.transaction_history_complete,
  plan.coverage_state,
  plan.currency
from public.customer_economics_cost_pool_plan as plan
left join allocated
  on allocated.authoritative_source_type = plan.authoritative_source_type
 and allocated.authoritative_source_id = plan.authoritative_source_id;

revoke all on public.customer_economics_cost_pool_reconciliation from public;
revoke all on public.customer_economics_cost_pool_reconciliation from anon;
revoke all on public.customer_economics_cost_pool_reconciliation from authenticated;
grant select on public.customer_economics_cost_pool_reconciliation to authenticated;
grant select on public.customer_economics_cost_pool_reconciliation to service_role;

comment on view public.customer_economics_cost_pool_reconciliation is
  'Task 2 hard invariant surface. For every eligible known authoritative cost pool, Allocated Cost + Unallocated Cost must equal the authoritative pool exactly; missing authoritative amounts remain unavailable rather than becoming zero.';

create or replace view public.customer_economics_period_quality
with (security_invoker = true, security_barrier = true)
as
with cost_quality as (
  select
    reconciliation.business_id,
    reconciliation.activity_month,
    count(*) filter (
      where reconciliation.cost_eligibility = 'eligible'
        and reconciliation.allocation_quality_state = 'incomplete'
    )::bigint as incomplete_cost_pool_count,
    count(*) filter (
      where reconciliation.cost_eligibility = 'eligible'
        and reconciliation.allocation_quality_state = 'estimated'
    )::bigint as estimated_cost_pool_count,
    count(*) filter (
      where reconciliation.cost_eligibility = 'eligible'
        and reconciliation.reconciles is false
    )::bigint as unreconciled_cost_pool_count
  from public.customer_economics_cost_pool_reconciliation as reconciliation
  group by reconciliation.business_id, reconciliation.activity_month
),
legacy as (
  select
    legacy.business_id,
    legacy.cohort_month as activity_month,
    count(*)::bigint as unresolved_legacy_count
  from public.customer_economics_legacy_manual_allocations as legacy
  where not legacy.eligible_for_new_engine
  group by legacy.business_id, legacy.cohort_month
)
select
  financial_basis.business_id,
  financial_basis.activity_month,
  coalesce(history.is_complete, false) as transaction_history_complete,
  coverage.coverage_state,
  coverage.coverage_difference,
  coverage.coverage_tolerance,
  coalesce(cost_quality.incomplete_cost_pool_count, 0) as incomplete_cost_pool_count,
  coalesce(cost_quality.estimated_cost_pool_count, 0) as estimated_cost_pool_count,
  coalesce(cost_quality.unreconciled_cost_pool_count, 0) as unreconciled_cost_pool_count,
  coalesce(legacy.unresolved_legacy_count, 0) as unresolved_legacy_count,
  case
    when not coalesce(history.is_complete, false) then 'incomplete'
    when coverage.coverage_state <> 'COVERED' then 'incomplete'
    when coalesce(cost_quality.incomplete_cost_pool_count, 0) > 0 then 'incomplete'
    when coalesce(cost_quality.unreconciled_cost_pool_count, 0) > 0 then 'incomplete'
    when coalesce(legacy.unresolved_legacy_count, 0) > 0 then 'incomplete'
    when coalesce(cost_quality.estimated_cost_pool_count, 0) > 0 then 'estimated'
    else 'actual'
  end as quality_state,
  financial_basis.currency
from public.customer_economics_monthly_financial_basis as financial_basis
left join public.business_transaction_history_status as history
  on history.business_id = financial_basis.business_id
left join public.customer_economics_revenue_coverage as coverage
  on coverage.business_id = financial_basis.business_id
 and coverage.activity_month = financial_basis.activity_month
left join cost_quality
  on cost_quality.business_id = financial_basis.business_id
 and cost_quality.activity_month = financial_basis.activity_month
left join legacy
  on legacy.business_id = financial_basis.business_id
 and legacy.activity_month = financial_basis.activity_month;

revoke all on public.customer_economics_period_quality from public;
revoke all on public.customer_economics_period_quality from anon;
revoke all on public.customer_economics_period_quality from authenticated;
grant select on public.customer_economics_period_quality to authenticated;
grant select on public.customer_economics_period_quality to service_role;

comment on view public.customer_economics_period_quality is
  'Task 2 period-level Customer Economics quality derivation. Incomplete history, revenue coverage gaps, unresolved eligible costs, failed reconciliation, or unresolved legacy allocations block authoritative profitability; deterministic automatic allocations produce Estimated.';
