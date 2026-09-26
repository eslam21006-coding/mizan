import assert from "node:assert/strict";
import test from "node:test";
import {
  FUNNEL_MODULE_TABS,
  buildFunnelModuleHref,
} from "../../src/lib/funnel-module.ts";

test("N40 exposes exactly the three persistent Funnel module tabs", () => {
  assert.deepEqual(FUNNEL_MODULE_TABS, [
    { id: "structure", label: "الهيكل" },
    { id: "monthly", label: "الأداء الشهري" },
    { id: "liquidation", label: "تسييل الإنفاق" },
  ]);
});

test("N40 builds deterministic business-scoped Funnel module destinations", () => {
  const businessId = "123e4567-e89b-42d3-a456-426614174000";

  assert.equal(buildFunnelModuleHref(businessId, "structure"), `/businesses/${businessId}/funnels`);
  assert.equal(
    buildFunnelModuleHref(businessId, "monthly"),
    `/businesses/${businessId}/funnels/monthly`,
  );
  assert.equal(
    buildFunnelModuleHref(businessId, "liquidation"),
    `/businesses/${businessId}/liquidation`,
  );
});

test("N40 preserves a validated selected month across analytical Funnel tabs", () => {
  const businessId = "123e4567-e89b-42d3-a456-426614174000";

  assert.equal(
    buildFunnelModuleHref(businessId, "monthly", "2026-09"),
    `/businesses/${businessId}/funnels/monthly?month=2026-09`,
  );
  assert.equal(
    buildFunnelModuleHref(businessId, "liquidation", "2026-09"),
    `/businesses/${businessId}/liquidation?month=2026-09`,
  );
  assert.equal(
    buildFunnelModuleHref(businessId, "structure", "2026-09"),
    `/businesses/${businessId}/funnels?month=2026-09`,
  );
});

test("N40 encodes business and month values instead of accepting raw path fragments", () => {
  assert.equal(
    buildFunnelModuleHref("business/with space", "monthly", "2026/09"),
    "/businesses/business%2Fwith%20space/funnels/monthly?month=2026%2F09",
  );
});

test("N45 marks only Structure to Monthly navigation with a structured origin", () => {
  const businessId = "123e4567-e89b-42d3-a456-426614174000";

  assert.equal(
    buildFunnelModuleHref(businessId, "monthly", null, "funnel-structure"),
    `/businesses/${businessId}/funnels/monthly?origin=funnel-structure`,
  );
  assert.equal(
    buildFunnelModuleHref(businessId, "monthly", "2026-09", "funnel-structure"),
    `/businesses/${businessId}/funnels/monthly?month=2026-09&origin=funnel-structure`,
  );
  assert.equal(
    buildFunnelModuleHref(businessId, "structure", "2026-09", "funnel-structure"),
    `/businesses/${businessId}/funnels?month=2026-09`,
  );
  assert.equal(
    buildFunnelModuleHref(businessId, "liquidation", "2026-09", "funnel-structure"),
    `/businesses/${businessId}/liquidation?month=2026-09`,
  );
});
