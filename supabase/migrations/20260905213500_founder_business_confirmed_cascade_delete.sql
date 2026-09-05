create or replace function public.delete_business_confirmed(
  p_business_id uuid,
  p_confirmation text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_confirmation text := lower(btrim(coalesce(p_confirmation, '')));
  locked_business_id uuid;
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication is required to delete a business.';
  end if;

  if btrim(coalesce(p_confirmation, '')) <> 'حذف'
     and normalized_confirmation <> 'delete' then
    raise invalid_parameter_value using message = 'Type حذف or Delete to confirm business deletion.';
  end if;

  select business.id
  into locked_business_id
  from public.businesses as business
  where business.id = p_business_id
  for update;

  if not found then
    return false;
  end if;

  if not (select private.can_manage_business(p_business_id)) then
    raise insufficient_privilege using message = 'Only the business owner or an admin can delete this business.';
  end if;

  -- Delete deepest historical children first so setup-level RESTRICT links remain
  -- protective during ordinary item deletion while the explicit business-delete
  -- workflow can remove the entire business atomically.
  delete from public.monthly_front_end_expense_allocations
  where business_id = p_business_id;

  delete from public.monthly_revenue_entries
  where business_id = p_business_id;

  delete from public.monthly_expense_entries
  where business_id = p_business_id;

  delete from public.monthly_periods
  where business_id = p_business_id;

  delete from public.funnel_monthly_entries
  where business_id = p_business_id;

  delete from public.funnel_monthly_periods
  where business_id = p_business_id;

  delete from public.funnels
  where business_id = p_business_id;

  delete from public.customer_cohort_cost_allocations
  where business_id = p_business_id;

  delete from public.customer_transaction_duplicate_resolutions
  where business_id = p_business_id;

  delete from public.customer_transactions
  where business_id = p_business_id;

  delete from public.customer_transaction_sources
  where business_id = p_business_id;

  delete from public.simulator_scenario_overrides
  where business_id = p_business_id;

  delete from public.simulator_scenarios
  where business_id = p_business_id;

  delete from public.revenue_streams
  where business_id = p_business_id;

  delete from public.expense_items
  where business_id = p_business_id;

  delete from public.business_memberships
  where business_id = p_business_id;

  delete from public.businesses
  where id = p_business_id;

  return true;
end;
$$;

revoke all on function public.delete_business_confirmed(uuid, text) from public;
revoke all on function public.delete_business_confirmed(uuid, text) from anon;
revoke all on function public.delete_business_confirmed(uuid, text) from authenticated;
grant execute on function public.delete_business_confirmed(uuid, text) to authenticated;
grant execute on function public.delete_business_confirmed(uuid, text) to service_role;

comment on function public.delete_business_confirmed(uuid, text) is
  'Explicit irreversible whole-business deletion. Requires owner/admin authorization and the confirmation word حذف or Delete. Removes all Mizan data scoped to the business in one database transaction; ordinary direct business deletion remains protected by existing history guards.';
