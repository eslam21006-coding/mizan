import assert from "node:assert/strict";
import test from "node:test";
import { resolveNavigationDestination } from "../../src/lib/navigation-hierarchy.ts";

test("resolves the existing business dashboard route with safely encoded business context", () => {
  assert.equal(
    resolveNavigationDestination({ route: "business-overview", businessId: "business fixture/01" }),
    "/?business=business+fixture%2F01",
  );
});

test("preserves a validated month when returning to the business overview", () => {
  assert.equal(
    resolveNavigationDestination({
      route: "business-overview",
      businessId: "business fixture/01",
      month: "2026-09",
    }),
    "/?business=business+fixture%2F01&month=2026-09",
  );
});

test("resolves nested business routes without accepting arbitrary href strings", () => {
  assert.equal(
    resolveNavigationDestination({ route: "business-workspace", businessId: "business/01" }),
    "/businesses/business%2F01",
  );
  assert.equal(
    resolveNavigationDestination({ route: "business-settings", businessId: "business/01" }),
    "/businesses/business%2F01/settings",
  );
  assert.equal(
    resolveNavigationDestination({ route: "business-delete", businessId: "business/01" }),
    "/businesses/business%2F01/settings/delete",
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


test("resolves exact Insights anchors and preserves Insights origin through Monthly", () => {
  assert.equal(
    resolveNavigationDestination({
      route: "insights",
      businessId: "business fixture/01",
      month: "2026-09",
      insightId: "funnel_attendance_bottleneck:123e4567-e89b-42d3-a456-426614174000",
    }),
    "/insights?business=business+fixture%2F01&month=2026-09#insight-funnel_attendance_bottleneck%3A123e4567-e89b-42d3-a456-426614174000",
  );

  assert.equal(
    resolveNavigationDestination({
      route: "business-monthly",
      businessId: "business fixture/01",
      month: "2026-10",
      origin: "insights",
      returnMonth: "2026-09",
      insightRuleId: "non_media_cost_pressure",
    }),
    "/businesses/business%20fixture%2F01/monthly?month=2026-10&origin=insights&return_month=2026-09&insight_rule=non_media_cost_pressure",
  );
});


test("resolves typed Admin Mentee hierarchy destinations", () => {
  assert.equal(
    resolveNavigationDestination({ route: "admin-mentees" }),
    "/admin/mentees",
  );
  assert.equal(
    resolveNavigationDestination({
      route: "admin-mentee",
      menteeUserId: "mentee fixture/01",
    }),
    "/admin/mentees/mentee%20fixture%2F01",
  );
});
