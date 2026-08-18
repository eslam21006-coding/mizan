import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const sqlFiles = Object.freeze([
  "test/rls/supabase-auth-test-shim.sql",
  "supabase/migrations/20260818061945_task_4_business_ownership_rls.sql",
  "supabase/migrations/20260818095500_task_5_business_onboarding.sql",
  "supabase/migrations/20260818095501_task_5_validate_timezone_constraint.sql",
  "supabase/migrations/20260818105500_task_5_business_creation_idempotency.sql",
  "test/rls/task-4-business-ownership.test.sql",
  "test/business/task-5-business-onboarding.test.sql",
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

  console.log("Task 4-5 database-backed security and onboarding matrices passed.");
  return 0;
}

const isMainModule = Boolean(
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]),
);

if (isMainModule) {
  process.exitCode = runAttackMatrix();
}
