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
  "supabase/migrations/20260818105502_task_5_backfill_creation_request_ids.sql",
  "supabase/migrations/20260818105503_task_5_validate_creation_request_presence.sql",
  "supabase/migrations/20260818105504_task_5_set_creation_request_not_null.sql",
  "supabase/migrations/20260818105505_task_5_creation_request_unique_index.sql",
  "supabase/migrations/20260818105506_task_5_attach_creation_request_unique_constraint.sql",
  "supabase/migrations/20260818105507_task_5_creation_request_immutability.sql",
  "test/business/task-5-idempotency-backfill.test.sql",
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
  "test/business/task-8-history-delete-protection.test.sql",
  "test/business/task-8-monthly-data-entry.test.sql",
]);

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function validateDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error(
      "RLS_TEST_DATABASE_URL is required. Point it only at a disposable local database whose name ends in _test.",
    );
  }

  const parsedDatabaseUrl = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, ""));
  const loopbackHosts = new Set(["127.0.0.1"]);

  if (!loopbackHosts.has(parsedDatabaseUrl.hostname) || !databaseName.endsWith("_test")) {
    throw new Error(
      "Refusing to run destructive RLS setup unless RLS_TEST_DATABASE_URL uses the literal loopback address 127.0.0.1 and a database name ending in _test.",
    );
  }
}

export function buildExecutionPlan(databaseUrl) {
  validateDatabaseUrl(databaseUrl);

  return sqlFiles.map((sqlFile) => ({
    command: "psql",
    sqlFile,
    args: [
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--dbname",
      databaseUrl,
      "--file",
      sqlFile,
    ],
  }));
}

export function runAttackMatrix(databaseUrl = process.env.RLS_TEST_DATABASE_URL, spawn = spawnSync) {
  for (const execution of buildExecutionPlan(databaseUrl)) {
    const result = spawn(execution.command, execution.args, {
      cwd: repositoryRoot,
      env: { ...process.env, PGCONNECT_TIMEOUT: "5" },
      stdio: "inherit",
    });

    if (result.error) {
      throw new Error(`Failed to execute psql for ${execution.sqlFile}: ${result.error.message}`);
    }

    if (result.status !== 0) {
      return result.status ?? 1;
    }
  }

  console.log("Task 4-8 database-backed security and business matrices passed.");
  return 0;
}

const isMainModule = Boolean(
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]),
);

if (isMainModule) {
  process.exitCode = runAttackMatrix();
}
