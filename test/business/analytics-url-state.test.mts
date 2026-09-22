import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalyticsViewHref,
  parseAnalyticsView,
} from "../../src/lib/analytics-view.ts";

test("parses only allow-listed Analytics views", () => {
  assert.equal(parseAnalyticsView("comparison"), "comparison");
  assert.equal(parseAnalyticsView("trends"), "trends");
  assert.equal(parseAnalyticsView("unknown"), "comparison");
  assert.equal(parseAnalyticsView(["trends", "comparison"]), "comparison");
  assert.equal(parseAnalyticsView(undefined), "comparison");
});

test("builds Analytics view links with the exact known business, month, and period state", () => {
  const href = buildAnalyticsViewHref(
    {
      businessId: "business fixture/01",
      month: "2026-08",
      period: "custom",
      start: "2026-06",
      end: "2026-08",
    },
    "trends",
  );
  const url = new URL(href, "https://mizan.test");

  assert.equal(url.pathname, "/analytics");
  assert.equal(url.searchParams.get("business"), "business fixture/01");
  assert.equal(url.searchParams.get("month"), "2026-08");
  assert.equal(url.searchParams.get("view"), "trends");
  assert.equal(url.searchParams.get("period"), "custom");
  assert.equal(url.searchParams.get("start"), "2026-06");
  assert.equal(url.searchParams.get("end"), "2026-08");
  assert.equal([...url.searchParams.keys()].length, 6);
});
