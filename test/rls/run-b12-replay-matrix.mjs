import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const targetOverrideParameters = Object.freeze([
  "host",
  "hostaddr",
  "port",
  "dbname",
  "service",
  "servicefile",
]);
const targetEnvironmentVariables = Object.freeze([
  "PGHOST",
  "PGHOSTADDR",
  "PGPORT",
  "PGDATABASE",
  "PGSERVICE",
  "PGSERVICEFILE",
]);

/** Refuses to run destructive replay verification against anything except the disposable local test database. */
export function validateReplayDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error(
      "RLS_TEST_DATABASE_URL is required. Point it only at a disposable local database whose name ends in _test.",
    );
  }

  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const override = targetOverrideParameters.find((parameter) =>
    parsed.searchParams.has(parameter),
  );

  if (override) {
    throw new Error(
      `Refusing replay database URL with connection target override parameter: ${override}.`,
    );
  }
  if (parsed.hostname !== "127.0.0.1") {
    throw new Error("Replay verification requires the literal loopback address 127.0.0.1.");
  }
  if (parsed.port !== "5432") {
    throw new Error("Replay verification requires PostgreSQL test port 5432.");
  }
  if (!databaseName.endsWith("_test")) {
    throw new Error("Replay verification requires a database name ending in _test.");
  }
}

/** Builds a sanitized child-process environment that cannot redirect PostgreSQL connections. */
function psqlEnvironment() {
  const env = { ...process.env, PGCONNECT_TIMEOUT: "5" };
  for (const variable of targetEnvironmentVariables) delete env[variable];
  return env;
}

/** Builds fail-fast psql arguments for one synchronous SQL command. */
function psqlArgs(databaseUrl, sql) {
  return [
    "--no-psqlrc",
    "--set",
    "ON_ERROR_STOP=1",
    "--dbname",
    databaseUrl,
    "--tuples-only",
    "--no-align",
    "--command",
    sql,
  ];
}

/** Executes one SQL command synchronously against the validated disposable database. */
function runPsqlSync(databaseUrl, sql) {
  const result = spawnSync("psql", psqlArgs(databaseUrl, sql), {
    cwd: repositoryRoot,
    env: psqlEnvironment(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.error) throw result.error;
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/** Starts one multi-command psql session so transaction overlap can be observed directly. */
function startPsqlSession(databaseUrl, commands) {
  const args = [
    "--no-psqlrc",
    "--set",
    "ON_ERROR_STOP=1",
    "--dbname",
    databaseUrl,
  ];
  for (const command of commands) args.push("--command", command);

  const child = spawn("psql", args, {
    cwd: repositoryRoot,
    env: psqlEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exit = new Promise((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      resolvePromise({ code, signal });
    });
  });

  return {
    child,
    exit,
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

/** Creates one committed test-only release gate shared by separate PostgreSQL sessions. */
function createReleaseGate(databaseUrl) {
  const gate = `b12-replay-${randomUUID()}`;
  const result = runPsqlSync(
    databaseUrl,
    `create table if not exists public.b12_replay_release_gates (
  gate text primary key,
  released boolean not null default false
);
insert into public.b12_replay_release_gates (gate, released)
values ('${gate}', false);`,
  );
  assertSuccess(result, `create release gate ${gate}`);
  return gate;
}

/** Builds a holder-side polling block that keeps its transaction open until the runner releases it. */
function releaseGateWaitSql(gate) {
  return `do $release$
begin
  while not exists (
    select 1
    from public.b12_replay_release_gates
    where gate = '${gate}'
      and released
  ) loop
    perform pg_catalog.pg_sleep(0.05);
  end loop;
end
$release$;`;
}

/** Releases a holder only after its competing session has been observed blocked. */
function releaseGate(databaseUrl, gate) {
  const result = runPsqlSync(
    databaseUrl,
    `update public.b12_replay_release_gates
set released = true
where gate = '${gate}';`,
  );
  assertSuccess(result, `release gate ${gate}`);
}

/** Terminates one spawned session if it is still alive, then waits for process cleanup. */
async function terminateSession(session) {
  if (session.child.exitCode === null && session.child.signalCode === null) {
    session.child.kill("SIGTERM");
  }
  await session.exit;
}

/** Observes a waiter blocked at the persistence boundary and always releases or cleans up the holder. */
async function observeBlockedWaiterAndRelease({
  databaseUrl,
  gate,
  holder,
  waiter,
  applicationName,
  waitEvent = null,
}) {
  let observed = false;
  try {
    await waitForDatabaseLock(databaseUrl, applicationName, waitEvent);
    observed = true;
  } finally {
    releaseGate(databaseUrl, gate);
    if (!observed) {
      await Promise.all([terminateSession(holder), terminateSession(waiter)]);
    }
  }
}

/** Pauses briefly while polling deterministic database concurrency state. */
function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

/** Waits until the holder confirms it completed its write while keeping the transaction open. */
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

/** Proves a named waiter is blocked on a database lock before the holder transaction can finish. */
async function waitForDatabaseLock(
  databaseUrl,
  applicationName,
  waitEvent = null,
  timeoutMs = 5_000,
) {
  const escapedApplicationName = applicationName.replaceAll("'", "''");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const eventClause = waitEvent
      ? ` and wait_event = '${waitEvent.replaceAll("'", "''")}'`
      : "";
    const result = runPsqlSync(
      databaseUrl,
      `select count(*)
from pg_catalog.pg_stat_activity
where application_name = '${escapedApplicationName}'
  and wait_event_type = 'Lock'${eventClause};`,
    );
    assertSuccess(result, `inspect lock state for ${applicationName}`);
    if (Number(result.stdout.trim()) > 0) return;
    await sleep(50);
  }

  throw new Error(
    `Timed out waiting for ${applicationName} to block on ${waitEvent ?? "a database lock"}.`,
  );
}

/** Awaits a spawned session and requires a successful exit. */
async function requireSuccessfulSession(session, label) {
  const result = await session.exit;
  assert.equal(
    result.code,
    0,
    `${label} failed with code ${result.code ?? "null"} signal ${result.signal ?? "none"}. stdout=${session.stdout()} stderr=${session.stderr()}`,
  );
}

/** Awaits a spawned session and requires a database rejection matching the expected reason. */
async function requireRejectedSession(session, label, pattern) {
  const result = await session.exit;
  assert.notEqual(
    result.code,
    0,
    `${label} unexpectedly succeeded. stdout=${session.stdout()}`,
  );
  assert.match(session.stderr(), pattern);
}

/** Asserts success for a synchronous psql command and includes diagnostics on failure. */
function assertSuccess(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} failed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

/** Asserts a synchronous psql command was rejected for the expected reason. */
function assertRejected(result, label, pattern) {
  assert.notEqual(
    result.status,
    0,
    `${label} unexpectedly succeeded.\nstdout:\n${result.stdout}`,
  );
  assert.match(result.stderr, pattern);
}

/** Serializes deterministic authenticated mentee claims for an RLS test session. */
function claimsValue(userId) {
  return JSON.stringify({
    sub: userId,
    role: "authenticated",
    app_metadata: { role: "mentee" },
  }).replaceAll("'", "''");
}

/** Wraps SQL in one authenticated transaction for sequential replay and authorization checks. */
function authenticatedSql(userId, sql) {
  return `begin;
set local role authenticated;
set local request.jwt.claims = '${claimsValue(userId)}';
${sql}
commit;`;
}

/** Returns local authenticated-session commands for a transaction-spanning concurrency case. */
function authenticatedLocalCommands(userId) {
  return [
    "set local role authenticated",
    `set local request.jwt.claims = '${claimsValue(userId)}'`,
  ];
}

/** Quotes a JSON value as a safe SQL jsonb literal for generated test fixtures. */
function quoteJson(value) {
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
}

/** Counts rows persisted for one business/request identity after replay attempts. */
function countForRequest(databaseUrl, table, businessId, requestId) {
  const result = runPsqlSync(
    databaseUrl,
    `select count(*) from public.${table} where business_id = '${businessId}' and creation_request_id = '${requestId}';`,
  );
  assertSuccess(result, `count ${table} request ${requestId}`);
  return Number(result.stdout.trim());
}

/** Resolves the single persisted entity ID associated with one creation request. */
function idForRequest(databaseUrl, table, businessId, requestId) {
  const result = runPsqlSync(
    databaseUrl,
    `select id from public.${table} where business_id = '${businessId}' and creation_request_id = '${requestId}';`,
  );
  assertSuccess(result, `lookup ${table} request ${requestId}`);
  const id = result.stdout.trim();
  assert.match(id, /^[a-f\d-]{36}$/i, `Expected one persisted ${table} id.`);
  return id;
}

/** Builds the one SQL statement used for the known-number Monthly replay case. */
function monthlySaveStatement({
  businessId,
  monthStart,
  revenueStreamId,
  expenses,
}) {
  const revenuePayload = [
    {
      revenue_stream_id: revenueStreamId,
      gross_cash_collected: "10000",
      refunds: "1000",
    },
  ];
  const expensePayload = expenses.map(({ id, value }) => ({
    expense_item_id: id,
    display_value: value,
    customer_count_basis: null,
  }));

  return `select public.save_monthly_actuals(
  '${businessId}',
  '${monthStart}',
  10,
  10,
  null,
  null,
  null,
  ${quoteJson(revenuePayload)},
  ${quoteJson(expensePayload)}
)`;
}

/** Builds an authenticated transaction around the known-number Monthly replay statement. */
function monthlySaveSql(input) {
  return authenticatedSql(input.ownerId, `${monthlySaveStatement(input)};`);
}

/** Verifies row cardinality, every persisted component, and derived known-number invariants. */
function verifyKnownMonth(
  databaseUrl,
  businessId,
  monthStart,
  revenueStreamId,
  expenses,
) {
  const expenseChecks = expenses
    .map(
      ({ id, value, category }) => `
  if not exists (
    select 1
    from public.monthly_expense_entries
    where monthly_period_id = period_id
      and expense_item_id = '${id}'
      and category_snapshot = '${category}'
      and cost_behavior_snapshot = 'fixed_monthly'
      and input_value = ${value}
  ) then
    raise exception 'B12B.1 persisted ${category} expense changed after replay';
  end if;`,
    )
    .join("\n");

  const sql = `do $verify$
declare
  period_id uuid;
  new_customer_count integer;
  paying_customer_count integer;
  gross_cash numeric;
  refund_amount numeric;
  net_cash numeric;
  acquisition_cost numeric;
  fulfillment_cost numeric;
  overhead_cost numeric;
  financial_cost numeric;
  total_costs numeric;
  real_net_profit numeric;
  ultimate_cac numeric;
begin
  select id, new_customers, total_paying_customers
  into period_id, new_customer_count, paying_customer_count
  from public.monthly_periods
  where business_id = '${businessId}'
    and month_start = '${monthStart}';

  if period_id is null then
    raise exception 'B12B.1 expected one persisted monthly period';
  end if;

  if (
    select count(*)
    from public.monthly_periods
    where business_id = '${businessId}'
      and month_start = '${monthStart}'
  ) <> 1 then
    raise exception 'B12B.1 replay duplicated the monthly period';
  end if;

  if (
    select count(*)
    from public.monthly_revenue_entries
    where monthly_period_id = period_id
  ) <> 1 then
    raise exception 'B12B.1 replay duplicated monthly revenue rows';
  end if;

  if (
    select count(*)
    from public.monthly_expense_entries
    where monthly_period_id = period_id
  ) <> 4 then
    raise exception 'B12B.1 replay duplicated monthly expense rows';
  end if;

  if new_customer_count <> 10 or paying_customer_count <> 10 then
    raise exception 'B12B.1 customer counts changed after replay: %/%',
      new_customer_count, paying_customer_count;
  end if;

  select gross_cash_collected, refunds
  into gross_cash, refund_amount
  from public.monthly_revenue_entries
  where monthly_period_id = period_id
    and revenue_stream_id = '${revenueStreamId}';

  if gross_cash <> 10000 or refund_amount <> 1000 then
    raise exception 'B12B.1 gross cash/refunds changed after replay: %/%',
      gross_cash, refund_amount;
  end if;

${expenseChecks}

  select coalesce(sum(gross_cash_collected - refunds), 0)
  into net_cash
  from public.monthly_revenue_entries
  where monthly_period_id = period_id;

  select
    coalesce(sum(input_value) filter (where category_snapshot = 'acquisition'), 0),
    coalesce(sum(input_value) filter (where category_snapshot = 'fulfillment'), 0),
    coalesce(sum(input_value) filter (where category_snapshot = 'overhead'), 0),
    coalesce(sum(input_value) filter (where category_snapshot = 'financial'), 0)
  into acquisition_cost, fulfillment_cost, overhead_cost, financial_cost
  from public.monthly_expense_entries
  where monthly_period_id = period_id;

  total_costs := acquisition_cost + fulfillment_cost + overhead_cost + financial_cost;
  real_net_profit := net_cash - total_costs;
  ultimate_cac := total_costs / nullif(new_customer_count, 0);

  if net_cash <> 9000 then
    raise exception 'B12B.1 Net Cash changed after replay: %', net_cash;
  end if;
  if acquisition_cost <> 2000 then
    raise exception 'B12B.1 acquisition cost changed after replay: %', acquisition_cost;
  end if;
  if fulfillment_cost <> 1000 then
    raise exception 'B12B.1 fulfillment cost changed after replay: %', fulfillment_cost;
  end if;
  if overhead_cost <> 500 then
    raise exception 'B12B.1 overhead cost changed after replay: %', overhead_cost;
  end if;
  if financial_cost <> 500 then
    raise exception 'B12B.1 financial cost changed after replay: %', financial_cost;
  end if;
  if total_costs <> 4000 then
    raise exception 'B12B.1 total costs changed after replay: %', total_costs;
  end if;
  if real_net_profit <> 5000 then
    raise exception 'B12B.1 Real Net Profit changed after replay: %', real_net_profit;
  end if;
  if ultimate_cac <> 400 then
    raise exception 'B12B.1 Ultimate CAC changed after replay: %', ultimate_cac;
  end if;
end
$verify$;`;

  assertSuccess(runPsqlSync(databaseUrl, sql), `verify known month ${monthStart}`);
}

/** Exercises sequential and concurrent replay directly against PostgreSQL/RLS, not a browser fixture. */
export async function runB12ReplayMatrix(
  databaseUrl = process.env.RLS_TEST_DATABASE_URL,
) {
  validateReplayDatabaseUrl(databaseUrl);

  const ownerId = randomUUID();
  const outsiderId = randomUUID();
  const businessId = randomUUID();
  const businessRequestId = randomUUID();

  const revenueSequentialRequest = randomUUID();
  const revenueConcurrentRequest = randomUUID();
  const revenueDistinctRequest = randomUUID();

  const expenseSequentialRequest = randomUUID();
  const expenseConcurrentRequest = randomUUID();
  const expenseDistinctRequest = randomUUID();
  const expenseFinancialRequest = randomUUID();

  assertSuccess(
    runPsqlSync(
      databaseUrl,
      `insert into auth.users (id, email, raw_app_meta_data, created_at, updated_at)
values
  ('${ownerId}', 'b12-replay-owner-${ownerId}@example.test', '{"role":"mentee"}'::jsonb, now(), now()),
  ('${outsiderId}', 'b12-replay-outsider-${outsiderId}@example.test', '{"role":"mentee"}'::jsonb, now(), now());

insert into public.businesses (
  id, name, base_currency, timezone, owner_user_id, creation_request_id
) values (
  '${businessId}',
  'B12 Replay Safety',
  'USD',
  'Africa/Cairo',
  '${ownerId}',
  '${businessRequestId}'
);`,
    ),
    "create B12B.1 fixture",
  );

  const sequentialRevenueInsert = authenticatedSql(
    ownerId,
    `insert into public.revenue_streams (business_id, name, stream_type, creation_request_id)
values ('${businessId}', 'Replay Course', 'front_end', '${revenueSequentialRequest}');`,
  );
  assertSuccess(
    runPsqlSync(databaseUrl, sequentialRevenueInsert),
    "first sequential revenue request",
  );
  assertRejected(
    runPsqlSync(databaseUrl, sequentialRevenueInsert),
    "replayed sequential revenue request",
    /revenue_streams_business_creation_request_unique/i,
  );
  assert.equal(
    countForRequest(
      databaseUrl,
      "revenue_streams",
      businessId,
      revenueSequentialRequest,
    ),
    1,
  );

  const revenueReleaseGate = createReleaseGate(databaseUrl);
  const revenueHolder = startPsqlSession(databaseUrl, [
    "begin",
    ...authenticatedLocalCommands(ownerId),
    `insert into public.revenue_streams (business_id, name, stream_type, creation_request_id)
values ('${businessId}', 'Concurrent Replay Course', 'front_end', '${revenueConcurrentRequest}')`,
    "\\echo B12_REVENUE_INSERT_HELD",
    "reset role",
    releaseGateWaitSql(revenueReleaseGate),
    "commit",
  ]);
  await waitForMarker(revenueHolder, "B12_REVENUE_INSERT_HELD");

  const revenueWaiterName = `b12_revenue_waiter_${randomUUID()}`;
  const revenueWaiter = startPsqlSession(databaseUrl, [
    `set application_name = '${revenueWaiterName}'`,
    "begin",
    ...authenticatedLocalCommands(ownerId),
    `insert into public.revenue_streams (business_id, name, stream_type, creation_request_id)
values ('${businessId}', 'Concurrent Replay Course', 'front_end', '${revenueConcurrentRequest}')`,
    "commit",
  ]);
  await observeBlockedWaiterAndRelease({
    databaseUrl,
    gate: revenueReleaseGate,
    holder: revenueHolder,
    waiter: revenueWaiter,
    applicationName: revenueWaiterName,
  });
  await requireSuccessfulSession(revenueHolder, "concurrent revenue holder");
  await requireRejectedSession(
    revenueWaiter,
    "concurrent revenue replay",
    /revenue_streams_business_creation_request_unique/i,
  );
  assert.equal(
    countForRequest(
      databaseUrl,
      "revenue_streams",
      businessId,
      revenueConcurrentRequest,
    ),
    1,
  );

  assertSuccess(
    runPsqlSync(
      databaseUrl,
      authenticatedSql(
        ownerId,
        `insert into public.revenue_streams (business_id, name, stream_type, creation_request_id)
values ('${businessId}', 'Intentional New Revenue', 'backend', '${revenueDistinctRequest}');`,
      ),
    ),
    "distinct revenue request",
  );

  const sequentialExpenseInsert = authenticatedSql(
    ownerId,
    `insert into public.expense_items (
  business_id, name, category, cost_behavior, creation_request_id
) values (
  '${businessId}', 'Ads', 'acquisition', 'fixed_monthly', '${expenseSequentialRequest}'
);`,
  );
  assertSuccess(
    runPsqlSync(databaseUrl, sequentialExpenseInsert),
    "first sequential expense request",
  );
  assertRejected(
    runPsqlSync(databaseUrl, sequentialExpenseInsert),
    "replayed sequential expense request",
    /expense_items_business_creation_request_unique/i,
  );
  assert.equal(
    countForRequest(databaseUrl, "expense_items", businessId, expenseSequentialRequest),
    1,
  );

  const expenseReleaseGate = createReleaseGate(databaseUrl);
  const expenseHolder = startPsqlSession(databaseUrl, [
    "begin",
    ...authenticatedLocalCommands(ownerId),
    `insert into public.expense_items (
  business_id, name, category, cost_behavior, creation_request_id
) values (
  '${businessId}', 'Rent', 'overhead', 'fixed_monthly', '${expenseConcurrentRequest}'
)`,
    "\\echo B12_EXPENSE_INSERT_HELD",
    "reset role",
    releaseGateWaitSql(expenseReleaseGate),
    "commit",
  ]);
  await waitForMarker(expenseHolder, "B12_EXPENSE_INSERT_HELD");

  const expenseWaiterName = `b12_expense_waiter_${randomUUID()}`;
  const expenseWaiter = startPsqlSession(databaseUrl, [
    `set application_name = '${expenseWaiterName}'`,
    "begin",
    ...authenticatedLocalCommands(ownerId),
    `insert into public.expense_items (
  business_id, name, category, cost_behavior, creation_request_id
) values (
  '${businessId}', 'Rent', 'overhead', 'fixed_monthly', '${expenseConcurrentRequest}'
)`,
    "commit",
  ]);
  await observeBlockedWaiterAndRelease({
    databaseUrl,
    gate: expenseReleaseGate,
    holder: expenseHolder,
    waiter: expenseWaiter,
    applicationName: expenseWaiterName,
  });
  await requireSuccessfulSession(expenseHolder, "concurrent expense holder");
  await requireRejectedSession(
    expenseWaiter,
    "concurrent expense replay",
    /expense_items_business_creation_request_unique/i,
  );
  assert.equal(
    countForRequest(databaseUrl, "expense_items", businessId, expenseConcurrentRequest),
    1,
  );

  assertSuccess(
    runPsqlSync(
      databaseUrl,
      authenticatedSql(
        ownerId,
        `insert into public.expense_items (
  business_id, name, category, cost_behavior, creation_request_id
) values (
  '${businessId}', 'Fulfillment', 'fulfillment', 'fixed_monthly', '${expenseDistinctRequest}'
);`,
      ),
    ),
    "distinct expense request",
  );
  assertSuccess(
    runPsqlSync(
      databaseUrl,
      authenticatedSql(
        ownerId,
        `insert into public.expense_items (
  business_id, name, category, cost_behavior, creation_request_id
) values (
  '${businessId}', 'Financial', 'financial', 'fixed_monthly', '${expenseFinancialRequest}'
);`,
      ),
    ),
    "financial expense request",
  );

  const revenueStreamId = idForRequest(
    databaseUrl,
    "revenue_streams",
    businessId,
    revenueSequentialRequest,
  );
  const expenses = [
    {
      id: idForRequest(
        databaseUrl,
        "expense_items",
        businessId,
        expenseSequentialRequest,
      ),
      value: "2000",
      category: "acquisition",
    },
    {
      id: idForRequest(
        databaseUrl,
        "expense_items",
        businessId,
        expenseDistinctRequest,
      ),
      value: "1000",
      category: "fulfillment",
    },
    {
      id: idForRequest(
        databaseUrl,
        "expense_items",
        businessId,
        expenseConcurrentRequest,
      ),
      value: "500",
      category: "overhead",
    },
    {
      id: idForRequest(
        databaseUrl,
        "expense_items",
        businessId,
        expenseFinancialRequest,
      ),
      value: "500",
      category: "financial",
    },
  ];

  const sequentialMonthSql = monthlySaveSql({
    ownerId,
    businessId,
    monthStart: "2099-10-01",
    revenueStreamId,
    expenses,
  });
  assertSuccess(
    runPsqlSync(databaseUrl, sequentialMonthSql),
    "first sequential monthly save",
  );
  assertSuccess(
    runPsqlSync(databaseUrl, sequentialMonthSql),
    "replayed sequential monthly save",
  );
  verifyKnownMonth(
    databaseUrl,
    businessId,
    "2099-10-01",
    revenueStreamId,
    expenses,
  );

  const monthlyStatement = monthlySaveStatement({
    businessId,
    monthStart: "2099-11-01",
    revenueStreamId,
    expenses,
  });

  const monthlyReleaseGate = createReleaseGate(databaseUrl);
  const monthlyHolder = startPsqlSession(databaseUrl, [
    "begin",
    ...authenticatedLocalCommands(ownerId),
    monthlyStatement,
    "\\echo B12_MONTHLY_SAVE_HELD",
    "reset role",
    releaseGateWaitSql(monthlyReleaseGate),
    "commit",
  ]);
  await waitForMarker(monthlyHolder, "B12_MONTHLY_SAVE_HELD");

  const monthlyWaiterName = `b12_monthly_waiter_${randomUUID()}`;
  const monthlyWaiter = startPsqlSession(databaseUrl, [
    `set application_name = '${monthlyWaiterName}'`,
    "begin",
    ...authenticatedLocalCommands(ownerId),
    monthlyStatement,
    "commit",
  ]);
  await observeBlockedWaiterAndRelease({
    databaseUrl,
    gate: monthlyReleaseGate,
    holder: monthlyHolder,
    waiter: monthlyWaiter,
    applicationName: monthlyWaiterName,
    waitEvent: "advisory",
  });
  await requireSuccessfulSession(monthlyHolder, "concurrent monthly holder");
  await requireSuccessfulSession(monthlyWaiter, "concurrent monthly replay");
  verifyKnownMonth(
    databaseUrl,
    businessId,
    "2099-11-01",
    revenueStreamId,
    expenses,
  );

  const outsiderRevenueRequest = randomUUID();
  assertRejected(
    runPsqlSync(
      databaseUrl,
      authenticatedSql(
        outsiderId,
        `insert into public.revenue_streams (business_id, name, stream_type, creation_request_id)
values ('${businessId}', 'Unauthorized Revenue', 'front_end', '${outsiderRevenueRequest}');`,
      ),
    ),
    "outsider revenue creation",
    /row-level security|permission denied/i,
  );
  assert.equal(
    countForRequest(databaseUrl, "revenue_streams", businessId, outsiderRevenueRequest),
    0,
  );

  assertRejected(
    runPsqlSync(
      databaseUrl,
      monthlySaveSql({
        ownerId: outsiderId,
        businessId,
        monthStart: "2099-12-01",
        revenueStreamId,
        expenses,
      }),
    ),
    "outsider monthly save",
    /not allowed to manage monthly actuals|permission denied/i,
  );

  console.log(
    "B12B.1 replay safety passed: creation IDs and identical monthly saves are sequentially and concurrently idempotent with unchanged component-level and derived known-number totals.",
  );
}

const isMainModule = Boolean(
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]),
);
if (isMainModule) {
  runB12ReplayMatrix().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
