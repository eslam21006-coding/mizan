import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const databaseUrl = process.env.RLS_TEST_DATABASE_URL;
const targetOverrideParameters = ["host", "hostaddr", "port", "dbname", "service", "servicefile"];
const targetEnvironmentVariables = [
  "PGHOST",
  "PGHOSTADDR",
  "PGPORT",
  "PGDATABASE",
  "PGSERVICE",
  "PGSERVICEFILE",
];

/** Ensures this destructive follow-on matrix targets only the disposable local test database. */
function validateDatabaseUrl(value) {
  if (!value) {
    throw new Error(
      "RLS_TEST_DATABASE_URL is required. Point it only at a disposable local database whose name ends in _test.",
    );
  }

  const parsed = new URL(value);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const overrideParameter = targetOverrideParameters.find((parameter) =>
    parsed.searchParams.has(parameter),
  );

  if (overrideParameter) {
    throw new Error(
      `Refusing RLS database URL with connection target override parameter: ${overrideParameter}.`,
    );
  }

  if (parsed.hostname !== "127.0.0.1" || parsed.port !== "5432" || !databaseName.endsWith("_test")) {
    throw new Error(
      "Refusing transaction-history completeness tests unless RLS_TEST_DATABASE_URL uses 127.0.0.1:5432 and a database name ending in _test.",
    );
  }
}

/** Builds a PostgreSQL environment that cannot redirect the approved database target. */
function buildEnvironment() {
  const environment = { ...process.env, PGCONNECT_TIMEOUT: "5" };
  for (const variable of targetEnvironmentVariables) delete environment[variable];
  return environment;
}

/** Executes a SQL file after the transaction-derived matrix has established the prerequisite schema. */
function runPsqlFile(sqlFile, environment) {
  const result = spawnSync(
    "psql",
    ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--dbname", databaseUrl, "--file", sqlFile],
    {
      cwd: repositoryRoot,
      env: environment,
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`psql failed for ${sqlFile} with status ${result.status ?? "unknown"}.`);
  }
}

validateDatabaseUrl(databaseUrl);
const environment = buildEnvironment();

runPsqlFile(
  "supabase/migrations/20260906123000_transaction_history_completeness_guard.sql",
  environment,
);
runPsqlFile(
  "test/business/transaction-history-completion-integrity-preexisting.fixture.sql",
  environment,
);
runPsqlFile(
  "supabase/migrations/20260906184600_transaction_history_completion_integrity.sql",
  environment,
);
runPsqlFile("test/business/transaction-history-completion-integrity.test.sql", environment);
runPsqlFile("test/business/transaction-history-completeness.test.sql", environment);
runPsqlFile("test/business/transaction-history-confirmer-delete.test.sql", environment);
runPsqlFile("test/business/transaction-history-zero-month.test.sql", environment);

console.log(
  "Transaction-history completeness guard passed migration repair, saved-purchase prerequisites, default-incomplete, paying/new trust, owner/admin, member/outsider, direct-write denial, confirmer-deletion audit retention, zero-count authority, and manual-count conflict tests.",
);
