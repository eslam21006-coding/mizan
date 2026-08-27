create or replace view public.simulator_scenario_override_display
with (security_invoker = true, security_barrier = true)
as
select
  override_row.business_id,
  override_row.scenario_id,
  override_row.override_key,
  pg_catalog.trim_scale(override_row.override_value)::text as override_value_text,
  override_row.created_at,
  override_row.updated_at
from public.simulator_scenario_overrides as override_row;

revoke all on public.simulator_scenario_override_display from public;
revoke all on public.simulator_scenario_override_display from anon;
revoke all on public.simulator_scenario_override_display from authenticated;
grant select on public.simulator_scenario_override_display to authenticated;
grant select on public.simulator_scenario_override_display to service_role;

comment on view public.simulator_scenario_override_display is
  'Task 33 exact-text read surface for simulator numeric overrides. Security invoker preserves the Task 32 business RLS boundary while avoiding JavaScript floating-point rehydration of PostgreSQL numeric values.';
