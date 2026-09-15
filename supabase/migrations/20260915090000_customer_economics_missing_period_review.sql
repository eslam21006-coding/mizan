-- Founder UX follow-up: if Customer Economics detects customer activity in a month
-- that has no financial period, the review workflow must expose that exact month
-- instead of sending the founder to an apparently clean review page.
create or replace view public.customer_economics_missing_period_exceptions
with (security_invoker = true, security_barrier = true)
as
select distinct
  evidence.business_id,
  evidence.activity_month,
  'BUSINESS_NET_CASH_MISSING'::text as exception_code,
  null::uuid as authoritative_source_id,
  null::text as expense_name_snapshot,
  null::numeric as amount,
  business.base_currency as currency,
  false as can_manual_override,
  true as blocking
from public.customer_economics_activity_evidence as evidence
join public.businesses as business
  on business.id = evidence.business_id
left join public.customer_economics_period_quality as period_quality
  on period_quality.business_id = evidence.business_id
 and period_quality.activity_month = evidence.activity_month
where period_quality.activity_month is null;

revoke all on public.customer_economics_missing_period_exceptions from public;
revoke all on public.customer_economics_missing_period_exceptions from anon;
revoke all on public.customer_economics_missing_period_exceptions from authenticated;
grant select on public.customer_economics_missing_period_exceptions to authenticated;
grant select on public.customer_economics_missing_period_exceptions to service_role;

comment on view public.customer_economics_missing_period_exceptions is
  'Founder remediation surface for Customer Economics activity months that have no monthly financial period. Rows use the existing BUSINESS_NET_CASH_MISSING founder workflow so the exact month opens in Monthly Actuals. Security invoker preserves existing tenant RLS.';
