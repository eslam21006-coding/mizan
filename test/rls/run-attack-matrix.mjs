import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.RLS_TEST_DATABASE_URL;
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

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const sqlFiles = [
  "test/rls/supabase-auth-test-shim.sql",
  "supabase/migrations/20260818061945_task_4_business_ownership_rls.sql",
  "test/rls/task-4-business-ownership.test.sql",
];

for (const sqlFile of sqlFiles) {
  const result = spawnSync(
    "psql",
    ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--dbname", databaseUrl, "--file", sqlFile],
    {
      cwd: repositoryRoot,
      env: { ...process.env, PGCONNECT_TIMEOUT: "5" },
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw new Error(`Failed to execute psql for ${sqlFile}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Task 4 database-backed RLS attack matrix passed.");
