import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  calculateCoreFinancials,
  type CoreCalculationInput,
} from "../../src/lib/business/calculations.ts";
import { buildDecisionDashboardModel } from "../../src/lib/business/decision-dashboard.ts";
import { calculateFunnelMetrics } from "../../src/lib/business/funnel-calculations.ts";

function businessMonth({ revenue, overhead }: { revenue: string; overhead: string }) {
  const input: CoreCalculationInput = {
    revenueStreams: [
      {
        id: "main",
        name: "Main",
        streamType: "other",
        grossCashCollected: revenue,
        refunds: "0",
      },
    ],
    expenses: [
      {
        id: "media",
        name: "Media",
        category: "acquisition",
        behavior: "fixed_monthly",
        inputValue: "100",
      },
      {
        id: "overhead",
        name: "Overhead",
        category: "overhead",
        behavior: "fixed_monthly",
        inputValue: overhead,
      },
    ],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers: 10,
    totalPayingCustomers: 10,
    canonicalAdSpend: "100",
  };
  return calculateCoreFinancials(input);
}

test("Decision dashboard composes Tasks 26-28 and caps deterministic output at Top 3", () => {
  const previous = businessMonth({ revenue: "1000", overhead: "100" });
  const current = businessMonth({ revenue: "1200", overhead: "500" });
  const funnel = calculateFunnelMetrics({
    adSpend: "100",
    leads: 100,
    bookedCalls: 50,
    showedCalls: 32,
    qualifiedCalls: 30,
    sales: 7,
    newCustomers: 7,
    cashCollected: "700",
    attributedRevenue: "700",
  });

  const model = buildDecisionDashboardModel({
    currentBusiness: current,
    previousBusiness: previous,
    adSpendReconciliation: { status: "matched" },
    funnels: [{ id: "calls", name: "Calls", metrics: funnel }],
  });

  assert.equal(model.insights.length, 3);
  assert.deepEqual(
    model.insights.map((insight) => insight.ruleId),
    ["unhealthy_growth", "non_media_cost_pressure", "funnel_attendance_bottleneck"],
  );
  assert.equal(model.fallbackMessageAr, null);
  assert.match(model.insights[1]?.messageAr ?? "", /التكلفة الكاملة للبزنس لكل عميل جديد/);
});

test("Decision dashboard fails closed when the comparison evidence is insufficient", () => {
  const current = businessMonth({ revenue: "1200", overhead: "500" });
  const model = buildDecisionDashboardModel({
    currentBusiness: current,
    previousBusiness: null,
    adSpendReconciliation: null,
    funnels: [],
  });

  assert.deepEqual(model.insights, []);
  assert.equal(model.fallbackMessageAr, "البيانات غير كافية للحكم");
  assert.ok(model.evaluations.some((evaluation) => evaluation.status === "insufficient"));
});

test("Decision Engine route is user-facing, RTL-ready, and preserves locked product wording", () => {
  const navigation = fs.readFileSync("src/lib/navigation.ts", "utf8");
  const page = fs.readFileSync("src/app/(app)/insights/page.tsx", "utf8");
  const panel = fs.readFileSync(
    "src/app/(app)/insights/decision-insights-panel.tsx",
    "utf8",
  );

  assert.match(navigation, /label: "أهم الملاحظات", href: "\/insights"/);
  assert.match(page, /loadDecisionDashboard/);
  assert.match(panel, /أهم 3 ملاحظات/);
  assert.match(panel, /التكلفة الكاملة للبزنس لكل عميل جديد/);
  assert.match(panel, /لا توجد استنتاجات مولدة أو أرقام مفترضة/);
});
