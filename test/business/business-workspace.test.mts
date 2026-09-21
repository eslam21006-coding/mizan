import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_WORKSPACE_TABS,
  buildBusinessWorkspaceHref,
} from "../../src/lib/business-workspace.ts";

test("N36 exposes the four approved business workspace tabs in order", () => {
  assert.deepEqual(
    BUSINESS_WORKSPACE_TABS.map((tab) => [tab.id, tab.label]),
    [
      ["overview", "نظرة عامة"],
      ["revenue-streams", "مصادر الإيراد"],
      ["expenses", "هيكل المصروفات"],
      ["settings", "الإعدادات"],
    ],
  );
});

test("N36 builds only deterministic business-scoped workspace destinations", () => {
  const businessId = "123e4567-e89b-42d3-a456-426614174000";

  assert.equal(buildBusinessWorkspaceHref(businessId, "overview"), `/businesses/${businessId}`);
  assert.equal(
    buildBusinessWorkspaceHref(businessId, "revenue-streams"),
    `/businesses/${businessId}/revenue-streams`,
  );
  assert.equal(
    buildBusinessWorkspaceHref(businessId, "expenses"),
    `/businesses/${businessId}/expenses`,
  );
  assert.equal(
    buildBusinessWorkspaceHref(businessId, "settings"),
    `/businesses/${businessId}/settings`,
  );
});

test("N36 encodes business identifiers instead of accepting arbitrary path fragments", () => {
  assert.equal(
    buildBusinessWorkspaceHref("business / unsafe?x=1", "settings"),
    "/businesses/business%20%2F%20unsafe%3Fx%3D1/settings",
  );
});
