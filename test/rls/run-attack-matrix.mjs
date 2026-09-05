import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const sqlFiles = Object.freeze([
  "test/rls/supabase-auth-test-shim.sql",
  "supabase/migrations/20260818061945_task_4_business_ownership_rls.sql",
  "supabase/migrations/20260818095500_task_5_business_onboarding.sql",
  "supabase/migrations/20260818095501_task_5_validate_timezone_constraint.sql",
  "test/business/task-5-preexisting-business.fixture.sql",
  "supabase/migrations/20260818105500_task_5_business_creation_idempotency.sql",
  "supabase/migrations/20260818105501_task_5_creation_request_presence_check.sql",
  "test/business/task-5-idempotency-backfill.test.sql",
  "supabase/migrations/20260818105502_task_5_backfill_creation_request_ids.sql",
  "supabase/migrations/20260818105503_task_5_validate_creation_request_presence.sql",
  "supabase/migrations/20260818105504_task_5_set_creation_request_not_null.sql",
  "supabase/migrations/20260818105505_task_5_creation_request_unique_index.sql",
  "supabase/migrations/20260818105506_task_5_attach_creation_request_unique_constraint.sql",
  "supabase/migrations/20260818105507_task_5_creation_request_immutability.sql",
  "test/rls/task-4-business-ownership.test.sql",
  "test/business/task-5-business-onboarding.test.sql",
  "supabase/migrations/20260818153600_task_6_revenue_stream_management.sql",
  "test/business/task-6-revenue-stream-management.test.sql",
  "supabase/migrations/20260819060840_task_7_expense_structure.sql",
  "test/business/task-7-pre-whitespace-constraint.fixture.sql",
  "supabase/migrations/20260819062048_task_7_expense_name_whitespace_constraint.sql",
  "supabase/migrations/20260819062811_task_7_preserve_trimmed_expense_name_length.sql",
  "test/business/task-7-expense-name-compatibility.test.sql",
  "test/business/task-7-expense-structure.test.sql",
  "supabase/migrations/20260819070000_task_8_monthly_data_entry.sql",
  "supabase/migrations/20260819071000_task_8_harden_monthly_rpc_boundary.sql",
  "supabase/migrations/20260819072000_task_8_preserve_percentage_rate_precision.sql",
  "test/business/task-8-percentage-precision.test.sql",
  "supabase/migrations/20260819073000_task_8_protect_historical_setup_links.sql",
  "supabase/migrations/20260819074000_task_8_defer_history_link_checks.sql",
  "supabase/migrations/20260819083834_task_8_preserve_missing_unallocated_and_basis_validation.sql",
  "test/business/task-8-missing-value-validation.test.sql",
  "test/business/task-8-history-delete-protection.test.sql",
  "test/business/task-8-monthly-data-entry.test.sql",
  "supabase/migrations/20260821001500_task_14_funnel_management.sql",
  "supabase/migrations/20260821013000_task_14_protect_funnel_creation_identity.sql",
  "supabase/migrations/20260821110500_task_14_restrict_funnel_business_delete.sql",
  "test/business/task-14-funnel-management.test.sql",
  "test/business/task-14-funnel-retention.test.sql",
  "supabase/migrations/20260821113500_task_15_funnel_monthly_metrics.sql",
  "test/business/task-15-funnel-monthly-metrics.test.sql",
  "supabase/migrations/20260821160000_task_16_self_liquidating_funnel_engine.sql",
  "test/business/task-16-self-liquidating-funnel.test.sql",
  "supabase/migrations/20260824180000_task_20_transaction_duplicate_protection.sql",
  "test/business/task-20-transaction-duplicate-protection.test.sql",
  "test/business/task-20-hardening-preexisting.fixture.sql",
  "supabase/migrations/20260825103000_task_20_import_semantics_hardening.sql",
  "test/business/task-20-import-semantics-hardening.test.sql",
  "supabase/migrations/20260825114500_task_21_customer_identity_grouping.sql",
  "test/business/task-21-customer-identity-grouping.test.sql",
  "supabase/migrations/20260825135900_task_22_lock_transaction_reporting_basis.sql",
  "test/business/task-22-reporting-basis-lock.test.sql",
  "supabase/migrations/20260825140000_task_22_cohort_engine.sql",
  "test/business/task-22-cohort-engine.test.sql",
  "supabase/migrations/20260825143000_task_23_observed_ltv.sql",
  "test/business/task-23-observed-ltv.test.sql",
  "supabase/migrations/20260826093000_task_24_lifetime_revenue_stream_analysis.sql",
  "supabase/migrations/20260826093100_task_24_support_other_revenue_stream.sql",
  "supabase/migrations/20260826093200_task_24_attribution_display.sql",
  "test/business/task-24-lifetime-revenue-stream-analysis.test.sql",
  "test/business/task-24-other-revenue-stream-regression.test.sql",
  "supabase/migrations/20260826094500_task_25_lifetime_contribution_profit.sql",
  "supabase/migrations/20260826094700_task_25_exact_allocation_display.sql",
  "test/business/task-25-lifetime-contribution-profit.test.sql",
  "supabase/migrations/20260826202500_task_32_scenario_data_model.sql",
  "test/business/task-32-scenario-data-model.test.sql",
  "test/business/task-32-scenario-input-hardening.test.sql",
  "supabase/migrations/20260826213000_task_33_scenario_persistence_rpcs.sql",
  "supabase/migrations/20260826213100_task_33_scenario_override_display.sql",
  "test/business/task-33-scenario-persistence.test.sql",
  "supabase/migrations/20260827193000_task_35_admin_mentee_directory.sql",
  "test/rls/task-35-admin-mentee-directory.test.sql",
  "supabase/migrations/20260828145500_task_39_harden_security_definer_search_path.sql",
  "test/rls/task-39-full-security-review.test.sql",
  "supabase/migrations/20260905163000_founder_setup_item_safe_delete.sql",
  "test/business/founder-setup-item-safe-delete.test.sql",
]);

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const connectionTargetOverrideParameters = Object.freeze([
  "host",
  "hostaddr",
  "port",
  "dbname",
  "service",
  "servicefile",
]);
const connectionTargetEnvironmentVariables = Object.freeze([
  "PGHOST",
  "PGHOSTADDR",
  "PGPORT",
  "PGDATABASE",
  "PGSERVICE",
  "PGSERVICEFILE",
]);
const approvedTestDatabasePort = "5432";

function validateDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("RLS_TEST_DATABASE_URL is required. Point it only at a disposable local database whose name ends in _test.");
  }

  const parsedDatabaseUrl = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, ""));
  const overrideParameter = connectionTargetOverrideParameters.find((parameter) =>
    parsedDatabaseUrl.searchParams.has(parameter),
  );

  if (overrideParameter) {
    throw new Error(
      `Refusing RLS database URL with connection target override parameter: ${overrideParameter}.`,
    );
  }

  if (parsedDatabaseUrl.port !== approvedTestDatabasePort) {
    throw new Error(
      `Refusing RLS database URL unless it explicitly uses PostgreSQL test port ${approvedTestDatabasePort}.`,
    );
  }

  if (parsedDatabaseUrl.hostname !== "127.0.0.1" || !databaseName.endsWith("_test")) {
    throw new Error("Refusing to run destructive RLS setup unless RLS_TEST_DATABASE_URL uses the literal loopback address 127.0.0.1 and a database name ending in _test.");
  }
}

function buildPsqlEnvironment() {
  const childEnvironment = { ...process.env, PGCONNECT_TIMEOUT: "5" };
  for (const variable of connectionTargetEnvironmentVariables) delete childEnvironment[variable];
  return childEnvironment;
}

export function buildExecutionPlan(databaseUrl) {
  validateDatabaseUrl(databaseUrl);
  return sqlFiles.map((sqlFile) => ({
    command: "psql",
    sqlFile,
    args: ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--dbname", databaseUrl, "--file", sqlFile],
  }));
}

export function runAttackMatrix(databaseUrl = process.env.RLS_TEST_DATABASE_URL, spawn = spawnSync) {
  const childEnvironment = buildPsqlEnvironment();
  for (const execution of buildExecutionPlan(databaseUrl)) {
    const result = spawn(execution.command, execution.args, {
      cwd: repositoryRoot,
      env: childEnvironment,
      stdio: "inherit",
    });
    if (result.error) throw new Error(`Failed to execute psql for ${execution.sqlFile}: ${result.error.message}`);
    if (result.status !== 0) return result.status ?? 1;
  }
  console.log("Mizan database-backed security and business matrices passed, including safe setup-item deletion boundaries.");
  return 0;
}

const isMainModule = Boolean(process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]));
if (isMainModule) process.exitCode = runAttackMatrix();
