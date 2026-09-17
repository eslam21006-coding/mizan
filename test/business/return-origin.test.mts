import assert from "node:assert/strict";
import test from "node:test";
import { resolveNavigationDestination } from "../../src/lib/navigation-hierarchy.ts";
import { parseReturnOrigin, resolveReturnOrigin } from "../../src/lib/return-origin.ts";

test("parses allow-listed return origins with valid structured metadata", () => {
  assert.deepEqual(
    parseReturnOrigin({ origin: "customer-profitability", month: "2026-08" }),
    { origin: "customer-profitability", month: "2026-08" },
  );
  assert.deepEqual(parseReturnOrigin({ origin: "customer-overview" }), {
    origin: "customer-overview",
  });
  assert.deepEqual(parseReturnOrigin({ origin: "monthly-editor", month: "2026-09" }), {
    origin: "monthly-editor",
    month: "2026-09",
  });
});

test("rejects unknown, ambiguous, or malformed return origin metadata", () => {
  assert.equal(parseReturnOrigin({ returnTo: "https://evil.example/steal" }), null);
  assert.equal(parseReturnOrigin({ origin: "https://evil.example/steal" }), null);
  assert.equal(parseReturnOrigin({ origin: "monthly-editor" }), null);
  assert.equal(
    parseReturnOrigin({ origin: "customer-profitability", month: "2026-13" }),
    null,
  );
  assert.equal(
    parseReturnOrigin({ origin: ["customer-overview", "monthly-editor"], month: "2026-08" }),
    null,
  );
});

test("known origin ignores arbitrary returnTo and resolves only through typed destinations", () => {
  const origin = parseReturnOrigin({
    origin: "customer-profitability",
    month: "2026-08",
    returnTo: "https://evil.example/steal",
  });
  assert.deepEqual(origin, { origin: "customer-profitability", month: "2026-08" });
  assert.ok(origin);

  const destination = resolveReturnOrigin(origin, { businessId: "business fixture/01" });
  assert.equal(
    resolveNavigationDestination(destination),
    "/businesses/business%20fixture%2F01/customers?view=profitability&month=2026-08",
  );
});

test("URLSearchParams with duplicate origin keys is rejected as ambiguous", () => {
  const params = new URLSearchParams();
  params.append("origin", "customer-overview");
  params.append("origin", "monthly-editor");
  params.set("month", "2026-08");

  assert.equal(parseReturnOrigin(params), null);
});
