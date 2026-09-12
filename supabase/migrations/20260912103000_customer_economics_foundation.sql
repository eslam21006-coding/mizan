create or replace view public.customer_economics_expense_foundation
with (security_invoker = true, security_barrier = true)
as
select
  expense_entry.id as authoritative_source_id,
  'monthly_expense_entry'::text as authoritative_source_type,
  expense_entry.business_id,
  period.month_start as activity_month,
  expense_entry.monthly_period_id,
  expense_entry.expense_item_id,
  expense_entry.expense_name_snapshot,
  expense_entry.category_snapshot,
  expense_entry.cost_behavior_snapshot,
  expense_entry.customer_count_basis as customer_count_basis_snapshot,
  expense_entry.input_value as calculation_input_value,
  case
    when expense_entry.input_value is null then 'missing'
    else 'present'
  end as calculation_input_state,
  case
    when expense_entry.category_snapshot = 'acquisition' then 'eligible'
    when expense_entry.cost_behavior_snapshot = 'fixed_monthly' then 'excluded'
    else 'eligible'
  end as cost_eligibility,
  case
    when expense_entry.category_snapshot = 'acquisition' then 'new_customers'
    when expense_entry.cost_behavior_snapshot = 'fixed_monthly' then 'none'
    when expense_entry.cost_behavior_snapshot = 'percentage_revenue' then 'positive_collected_cash'
    when expense_entry.cost_behavior_snapshot = 'per_customer'
      and expense_entry.customer_count_basis = 'new_customers' then 'new_customers'
    when expense_entry.cost_behavior_snapshot = 'per_customer'
      and expense_entry.customer_count_basis = 'total_paying_customers' then 'paying_customers'
    else 'none'
  end as default_allocation_driver,
  case
    when expense_entry.category_snapshot = 'acquisition' then 'ACQUISITION_COST'
    when expense_entry.cost_behavior_snapshot = 'fixed_monthly'
      and expense_entry.category_snapshot = 'fulfillment' then 'FIXED_FULFILLMENT'
    when expense_entry.cost_behavior_snapshot = 'fixed_monthly'
      and expense_entry.category_snapshot = 'overhead' then 'FIXED_OVERHEAD'
    when expense_entry.cost_behavior_snapshot = 'fixed_monthly'
      and expense_entry.category_snapshot = 'financial' then 'FIXED_FINANCIAL'
    when expense_entry.cost_behavior_snapshot = 'per_customer'
      and expense_entry.customer_count_basis is null then 'MISSING_CUSTOMER_BASIS'
    else 'VARIABLE_CUSTOMER_COST'
  end as eligibility_reason
from public.monthly_expense_entries as expense_entry
join public.monthly_periods as period
  on period.id = expense_entry.monthly_period_id
 and period.business_id = expense_entry.business_id;

revoke all on public.customer_economics_expense_foundation from public;
revoke all on public.customer_economics_expense_foundation from anon;
revoke all on public.customer_economics_expense_foundation from authenticated;
grant select on public.customer_economics_expense_foundation to authenticated;
grant select on public.customer_economics_expense_foundation to service_role;

comment on view public.customer_economics_expense_foundation is
  'Task 1 Customer Economics source boundary. Each row maps exactly one authoritative monthly expense entry to its preserved historical category/behavior/basis and deterministic V1 eligibility/driver. This view does not create a second expense amount; authoritative monetary amounts continue to come from the existing monthly financial engine.';

create or replace view public.customer_economics_legacy_manual_allocations
with (security_invoker = true, security_barrier = true)
as
select
  allocation.id,
  allocation.business_id,
  allocation.cohort_month,
  allocation.cost_type,
  allocation.amount,
  allocation.attribution_method,
  allocation.note,
  allocation.eligibility_confirmed,
  allocation.created_by_user_id,
  allocation.updated_by_user_id,
  allocation.created_at,
  allocation.updated_at,
  'legacy_manual_unreconciled'::text as legacy_status,
  false as eligible_for_new_engine
from public.customer_cohort_cost_allocations as allocation;

revoke all on public.customer_economics_legacy_manual_allocations from public;
revoke all on public.customer_economics_legacy_manual_allocations from anon;
revoke all on public.customer_economics_legacy_manual_allocations from authenticated;
grant select on public.customer_economics_legacy_manual_allocations to authenticated;
grant select on public.customer_economics_legacy_manual_allocations to service_role;

comment on view public.customer_economics_legacy_manual_allocations is
  'Audit-only surface for pre-automatic Customer Economics manual acquisition-group allocations. Rows are preserved but are explicitly unreconciled and excluded from the new engine until a later reconciliation workflow links them to an authoritative expense pool.';

comment on table public.customer_cohort_cost_allocations is
  'Legacy manual acquisition-group cost allocations from the pre-automatic Customer Economics workflow. Preserve for audit. New Customer Economics calculations must not treat these rows as authoritative expense sources or include them until explicitly reconciled to authoritative historical expense pools.';
