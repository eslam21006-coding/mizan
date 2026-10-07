import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateReplayDatabaseUrl } from "./run-b12-replay-matrix.mjs";

const packageJson = JSON.parse(
  await readFile(new URL("../../package.json", import.meta.url), "utf8"),
);
const runnerSource = await readFile(
  new URL("./run-b12-replay-matrix.mjs", import.meta.url),
  "utf8",
);

test("B12B.1 database replay matrix is wired into the real RLS test command", () => {
  assert.match(packageJson.scripts["test:rls"], /run-b12-replay-matrix\.mjs/);
  assert.match(runnerSource, /waitForDatabaseLock/);
  assert.match(runnerSource, /startHeldPsqlSession/);
  assert.match(runnerSource, /releaseHeldSession/);
  assert.match(
    runnerSource,
    /waitForDatabaseLock\(databaseUrl, monthlyWaiterName, "advisory"\)/,
  );
  assert.doesNotMatch(runnerSource, /pg_sleep\(3\)/);
  assert.match(runnerSource, /revenue_streams_business_creation_request_unique/);
  assert.match(runnerSource, /expense_items_business_creation_request_unique/);
  assert.match(runnerSource, /public\.save_monthly_actuals/);
  assert.match(runnerSource, /gross_cash_collected = 10000/);
  assert.match(runnerSource, /refunds = 1000/);
  assert.match(runnerSource, /category_snapshot = '\$\{category\}'/);
  assert.match(runnerSource, /net_cash <> 9000/);
  assert.match(runnerSource, /total_costs <> 4000/);
  assert.match(runnerSource, /real_net_profit <> 5000/);
  assert.match(runnerSource, /ultimate_cac <> 400/);
});

test("B12B.1 replay matrix refuses non-disposable or redirected database targets", () => {
  assert.doesNotThrow(() =>
    validateReplayDatabaseUrl(
      "postgresql://postgres:postgres@127.0.0.1:5432/mizan_test",
    ),
  );

  for (const url of [
    "postgresql://postgres:postgres@localhost:5432/mizan_test",
    "postgresql://postgres:postgres@127.0.0.1:6543/mizan_test",
    "postgresql://postgres:postgres@127.0.0.1:5432/production",
    "postgresql://postgres:postgres@127.0.0.1:5432/mizan_test?host=example.com",
    "postgresql://postgres:postgres@127.0.0.1:5432/mizan_test?service=production",
  ]) {
    assert.throws(() => validateReplayDatabaseUrl(url));
  }
});
