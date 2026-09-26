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
  assert.deepEqual(parseReturnOrigin({ origin: "funnel-structure" }), {
    origin: "funnel-structure",
  });
  assert.deepEqual(
    parseReturnOrigin({ origin: "funnel-structure", month: "2026-08" }),
    { origin: "funnel-structure", month: "2026-08" },
  );
  assert.deepEqual(
    parseReturnOrigin({
      origin: "insights",
      month: "2026-09",
      insight_rule: "unhealthy_growth",
    }),
    { origin: "insights", month: "2026-09", ruleId: "unhealthy_growth" },
  );
  assert.deepEqual(
    parseReturnOrigin({
      origin: "insights",
      month: "2026-09",
      insight_rule: "funnel_attendance_bottleneck",
      insight_subject: "123e4567-e89b-42d3-a456-426614174000",
    }),
    {
      origin: "insights",
      month: "2026-09",
      ruleId: "funnel_attendance_bottleneck",
      subjectId: "123e4567-e89b-42d3-a456-426614174000",
    },
  );
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
    parseReturnOrigin({ origin: "customer-profitability", month: "2026-08\n" }),
    null,
  );
  assert.equal(
    parseReturnOrigin({ origin: ["customer-overview", "monthly-editor"], month: "2026-08" }),
    null,
  );
  assert.equal(
    parseReturnOrigin({ origin: "customer-profitability", month: ["2026-08", "2026-09"] }),
    null,
  );
  assert.equal(
    parseReturnOrigin({
      origin: "insights",
      month: "2026-09",
      insight_rule: "not-a-rule",
    }),
    null,
  );
  assert.equal(
    parseReturnOrigin({
      origin: "insights",
      month: "2026-09",
      insight_rule: "funnel_attendance_bottleneck",
    }),
    null,
  );
  assert.equal(
    parseReturnOrigin({
      origin: "insights",
      month: "2026-09",
      insight_rule: "unhealthy_growth",
      insight_subject: "unexpected-subject",
    }),
    null,
  );
  assert.equal(
    parseReturnOrigin({
      origin: "insights",
      month: "2026-09",
      insight_rule: "unhealthy_growth",
      insight_subject: "",
    }),
    null,
  );
  assert.equal(
    parseReturnOrigin({
      origin: "insights",
      month: "2026-09",
      insight_rule: ["unhealthy_growth", "non_media_cost_pressure"],
    }),
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

test("URLSearchParams with duplicate structured keys is rejected as ambiguous", () => {
  const duplicateOrigin = new URLSearchParams();
  duplicateOrigin.append("origin", "customer-overview");
  duplicateOrigin.append("origin", "monthly-editor");
  duplicateOrigin.set("month", "2026-08");
  assert.equal(parseReturnOrigin(duplicateOrigin), null);

  const duplicateMonth = new URLSearchParams();
  duplicateMonth.set("origin", "customer-profitability");
  duplicateMonth.append("month", "2026-08");
  duplicateMonth.append("month", "2026-09");
  assert.equal(parseReturnOrigin(duplicateMonth), null);
});

test("Funnel Structure origin resolves only to the current business Funnel Structure page", () => {
  const origin = parseReturnOrigin({ origin: "funnel-structure", month: "2026-08" });
  assert.deepEqual(origin, { origin: "funnel-structure", month: "2026-08" });
  assert.ok(origin);

  const destination = resolveReturnOrigin(origin, { businessId: "business fixture/01" });
  assert.equal(
    resolveNavigationDestination(destination),
    "/businesses/business%20fixture%2F01/funnels?month=2026-08",
  );
});


test("Insights origin resolves to the exact originating insight card", () => {
  const origin = parseReturnOrigin({
    origin: "insights",
    month: "2026-09",
    insight_rule: "funnel_attendance_bottleneck",
    insight_subject: "123e4567-e89b-42d3-a456-426614174000",
  });
  assert.ok(origin);
  assert.equal(
    resolveNavigationDestination(
      resolveReturnOrigin(origin, { businessId: "business fixture/01" }),
    ),
    "/insights?business=business+fixture%2F01&month=2026-09#insight-funnel_attendance_bottleneck%3A123e4567-e89b-42d3-a456-426614174000",
  );
});
