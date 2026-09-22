import assert from "node:assert/strict";
import test from "node:test";
import { resolveInsightRemediation } from "../../src/lib/insight-remediation.ts";

const context = {
  businessId: "business fixture/01",
  monthKey: "2026-09",
};

test("routes profitability and non-media-cost insights to the exact business month", () => {
  assert.deepEqual(
    resolveInsightRemediation({ ruleId: "unhealthy_growth" }, context),
    {
      href: "/businesses/business%20fixture%2F01/monthly?month=2026-09&origin=insights&return_month=2026-09&insight_rule=unhealthy_growth",
      labelAr: "مراجعة أرقام وتكاليف الشهر",
    },
  );
  assert.deepEqual(
    resolveInsightRemediation({ ruleId: "non_media_cost_pressure" }, context),
    {
      href: "/businesses/business%20fixture%2F01/monthly?month=2026-09&origin=insights&return_month=2026-09&insight_rule=non_media_cost_pressure",
      labelAr: "مراجعة المصروفات خارج الميديا",
    },
  );
});

test("routes lifetime-economics insights to the exact customer profitability month", () => {
  assert.deepEqual(
    resolveInsightRemediation({ ruleId: "healthy_funnel_weak_lifetime" }, context),
    {
      href: "/businesses/business%20fixture%2F01/customers?view=profitability&month=2026-09&origin=insights&return_month=2026-09&insight_rule=healthy_funnel_weak_lifetime",
      labelAr: "مراجعة ربحية العميل",
    },
  );
  assert.deepEqual(
    resolveInsightRemediation({ ruleId: "rising_cac_lifetime_supported" }, context),
    {
      href: "/businesses/business%20fixture%2F01/customers?view=profitability&month=2026-09&origin=insights&return_month=2026-09&insight_rule=rising_cac_lifetime_supported",
      labelAr: "مراجعة اقتصاديات العميل",
    },
  );
});

test("routes attendance insights to the exact funnel card for the selected month", () => {
  assert.deepEqual(
    resolveInsightRemediation(
      { ruleId: "funnel_attendance_bottleneck", subjectId: "funnel/a" },
      context,
    ),
    {
      href: "/businesses/business%20fixture%2F01/funnels/monthly?month=2026-09&origin=insights&return_month=2026-09&insight_rule=funnel_attendance_bottleneck&insight_subject=funnel%2Fa#funnel-funnel%2Fa",
      labelAr: "مراجعة أرقام الفانل",
    },
  );
});
