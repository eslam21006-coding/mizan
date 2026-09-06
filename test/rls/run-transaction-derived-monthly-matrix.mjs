import { spawn, spawnSync } from "node:child_process";
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

/** Ensures destructive matrix tests can run only against the disposable local test database. */
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
      "Refusing transaction-derived monthly tests unless RLS_TEST_DATABASE_URL uses 127.0.0.1:5432 and a database name ending in _test.",
    );
  }
}

/** Builds a sanitized PostgreSQL child-process environment that cannot redirect the target database. */
function buildEnvironment() {
  const environment = { ...process.env, PGCONNECT_TIMEOUT: "5" };
  for (const variable of targetEnvironmentVariables) delete environment[variable];
  return environment;
}

validateDatabaseUrl(databaseUrl);
const childEnvironment = buildEnvironment();

/** Returns the common safe psql arguments used by every matrix subprocess. */
function commonPsqlArgs() {
  return ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--dbname", databaseUrl];
}

/** Executes a SQL file synchronously and fails the matrix immediately on any psql error. */
function runPsqlFile(sqlFile) {
  const result = spawnSync("psql", [...commonPsqlArgs(), "--file", sqlFile], {
    cwd: repositoryRoot,
    env: childEnvironment,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`psql failed for ${sqlFile} with status ${result.status ?? "unknown"}.`);
  }
}

/** Executes one SQL command synchronously and returns its trimmed scalar/text output. */
function runPsqlCommand(sql) {
  const result = spawnSync(
    "psql",
    [...commonPsqlArgs(), "--tuples-only", "--no-align", "--command", sql],
    {
      cwd: repositoryRoot,
      env: childEnvironment,
      encoding: "utf8",
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `psql command failed with status ${result.status ?? "unknown"}.`);
  }
  return result.stdout.trim();
}

/** Starts an asynchronous psql session so lock ordering can be tested across real database sessions. */
function startPsqlSession(commands) {
  const args = commonPsqlArgs();
  for (const command of commands) args.push("--command", command);

  const child = spawn("psql", args, {
    cwd: repositoryRoot,
    env: childEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exit = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });

  return {
    child,
    exit,
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

/** Waits for a small deterministic delay while polling concurrent test state. */
function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Waits until a spawned psql session emits a synchronization marker or fails. */
async function waitForMarker(session, marker, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (session.stdout().includes(marker)) return;
    if (session.child.exitCode !== null || session.child.signalCode !== null) {
      throw new Error(
        `Session exited before marker ${marker}. stdout=${session.stdout()} stderr=${session.stderr()}`,
      );
    }
    await sleep(25);
  }
  throw new Error(`Timed out waiting for marker ${marker}. stdout=${session.stdout()}`);
}

/** Confirms a named database session is actually blocked on the shared advisory lock. */
async function waitForAdvisoryWait(applicationName, timeoutMs = 5_000) {
  const escapedApplicationName = applicationName.replaceAll("'", "''");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const waiting = Number(
      runPsqlCommand(
        `select count(*) from pg_catalog.pg_stat_activity where application_name = '${escapedApplicationName}' and wait_event_type = 'Lock' and wait_event = 'advisory';`,
      ),
    );
    if (waiting > 0) return;
    await sleep(50);
  }

  throw new Error(`Timed out waiting for ${applicationName} to block on the shared advisory lock.`);
}

/** Awaits a spawned psql session and surfaces stdout/stderr when the session fails. */
async function requireSuccessfulSession(session, label) {
  const result = await session.exit;
  if (result.code !== 0) {
    throw new Error(
      `${label} failed with code ${result.code ?? "null"} signal ${result.signal ?? "none"}. stdout=${session.stdout()} stderr=${session.stderr()}`,
    );
  }
}

/** Builds authenticated JWT claims for a test mentee session. */
function claims(userId) {
  return `set request.jwt.claims = '{"sub":"${userId}","role":"authenticated","app_metadata":{"role":"mentee"}}'`;
}

runPsqlFile("supabase/migrations/20260906064500_transaction_derived_monthly_customer_counts.sql");
runPsqlFile("test/business/transaction-derived-monthly-customers.test.sql");

runPsqlCommand(`
  insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
  values
    ('53535353-5353-4535-8535-535353535351', 'derived-race-save@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
    ('54545454-5454-4545-8545-545454545451', 'derived-race-insert@example.test', '{"role":"mentee"}'::jsonb, now(), now());

  insert into public.businesses (id, name, base_currency, timezone, owner_user_id, creation_request_id)
  values
    (
      '53535353-aaaa-4535-8535-535353535351',
      'Derived Race Save First',
      'USD',
      'Africa/Cairo',
      '53535353-5353-4535-8535-535353535351',
      '53535353-bbbb-4535-8535-535353535351'
    ),
    (
      '54545454-aaaa-4545-8545-545454545451',
      'Derived Race Insert First',
      'USD',
      'Africa/Cairo',
      '54545454-5454-4545-8545-545454545451',
      '54545454-bbbb-4545-8545-545454545451'
    );

  insert into public.customer_transaction_sources (business_id, source, created_by_user_id)
  values
    (
      '53535353-aaaa-4535-8535-535353535351',
      'stripe',
      '53535353-5353-4535-8535-535353535351'
    ),
    (
      '54545454-aaaa-4545-8545-545454545451',
      'stripe',
      '54545454-5454-4545-8545-545454545451'
    );
`);

const saveFirstHolder = startPsqlSession([
  "begin",
  "set role authenticated",
  claims("53535353-5353-4535-8535-535353535351"),
  `select public.save_monthly_actuals(
    '53535353-aaaa-4535-8535-535353535351',
    '2026-10-01',
    9,
    9,
    null,
    null,
    null,
    '[]'::jsonb,
    '[]'::jsonb
  )`,
  "\\echo MIZAN_SAVE_LOCK_HELD",
  "select pg_sleep(3)",
  "commit",
]);

await waitForMarker(saveFirstHolder, "MIZAN_SAVE_LOCK_HELD");

const importWaiter = startPsqlSession([
  "set application_name = 'mizan_import_waiter'",
  "set role authenticated",
  claims("53535353-5353-4535-8535-535353535351"),
  `select public.import_customer_transactions(
    '53535353-aaaa-4535-8535-535353535351',
    'stripe',
    '[{"row_number":1,"transaction_id":"race-save-first","import_row_token":"63535353-0000-4000-8000-000000000001","customer_email":"race-save@example.test","transaction_date":"2026-10-05T12:00:00+03:00","amount_collected":"100","transaction_type":"collection","normalized_outcome":"successful","currency":"USD"}]'::jsonb
  )`,
]);

await waitForAdvisoryWait("mizan_import_waiter");
await requireSuccessfulSession(saveFirstHolder, "save-first lock holder");
await requireSuccessfulSession(importWaiter, "import waiter");

runPsqlCommand(`
  do $$
  begin
    if not exists (
      select 1
      from public.monthly_periods
      where business_id = '53535353-aaaa-4535-8535-535353535351'
        and month_start = '2026-10-01'
        and new_customers = 1
        and total_paying_customers = 1
    ) then
      raise exception 'import did not refresh counts after waiting for an in-flight manual save';
    end if;
  end $$;
`);

const insertFirstHolder = startPsqlSession([
  "begin",
  `insert into public.customer_transactions (
    id, business_id, source, source_transaction_id, import_row_token, customer_email,
    transaction_date, source_transaction_at, transaction_at, amount_collected,
    transaction_type, normalized_outcome, currency, source_row_number, imported_by_user_id
  ) values (
    '64545454-0000-4000-8000-000000000001',
    '54545454-aaaa-4545-8545-545454545451',
    'stripe',
    'race-insert-first',
    '64545454-0000-4000-8000-000000000002',
    'race-insert@example.test',
    '2026-11-05',
    '2026-11-05T12:00:00+03:00',
    '2026-11-05T09:00:00Z'::timestamptz,
    100,
    'collection',
    'successful',
    'USD',
    1,
    '54545454-5454-4545-8545-545454545451'
  )`,
  "\\echo MIZAN_INSERT_LOCK_HELD",
  "select pg_sleep(3)",
  "commit",
]);

await waitForMarker(insertFirstHolder, "MIZAN_INSERT_LOCK_HELD");

const saveWaiter = startPsqlSession([
  "set application_name = 'mizan_save_waiter'",
  "set role authenticated",
  claims("54545454-5454-4545-8545-545454545451"),
  `select public.save_monthly_actuals(
    '54545454-aaaa-4545-8545-545454545451',
    '2026-11-01',
    7,
    7,
    null,
    null,
    null,
    '[]'::jsonb,
    '[]'::jsonb
  )`,
]);

await waitForAdvisoryWait("mizan_save_waiter");
await requireSuccessfulSession(insertFirstHolder, "insert-first lock holder");
await requireSuccessfulSession(saveWaiter, "save waiter");

runPsqlCommand(`
  do $$
  begin
    if not exists (
      select 1
      from public.monthly_periods
      where business_id = '54545454-aaaa-4545-8545-545454545451'
        and month_start = '2026-11-01'
        and new_customers = 1
        and total_paying_customers = 1
    ) then
      raise exception 'save did not derive counts after waiting for an in-flight qualifying insert';
    end if;
  end $$;
`);

console.log(
  "Transaction-derived monthly customer counts passed sequential refresh, authorization, and two-session advisory-lock tests.",
);
