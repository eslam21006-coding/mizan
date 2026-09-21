import assert from "node:assert/strict";
import test from "node:test";
import { resolveNavigationDestination } from "../../src/lib/navigation-hierarchy.ts";

test("resolves the existing business dashboard route with safely encoded business context", () => {
  assert.equal(
    resolveNavigationDestination({ route: "business-overview", businessId: "business fixture/01" }),
    "/?business=business+fixture%2F01",
  );
});

test("resolves nested business routes without accepting arbitrary href strings", () => {
  assert.equal(
    resolveNavigationDestination({ route: "business-workspace", businessId: "business/01" }),
    "/businesses/business%2F01",
  );
  assert.equal(
    resolveNavigationDestination({ route: "business-customers", businessId: "business/01" }),
    "/businesses/business%2F01/customers",
  );
  assert.equal(
    resolveNavigationDestination({
      route: "business-customers",
      businessId: "business/01",
      view: "profitability",
      month: "2026-08",
    }),
    "/businesses/business%2F01/customers?view=profitability&month=2026-08",
  );
  assert.equal(
    resolveNavigationDestination({ route: "business-customer-review", businessId: "business/01" }),
    "/businesses/business%2F01/customers/review",
  );
  assert.equal(
    resolveNavigationDestination({
      route: "business-monthly",
      businessId: "business/01",
      month: "2026-08",
    }),
    "/businesses/business%2F01/monthly?month=2026-08",
  );
});
