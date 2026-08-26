import assert from "node:assert/strict";
import test from "node:test";

import type { DecisionInsightCandidate } from "../../src/lib/business/decision-insights.ts";
import {
  MAX_DECISION_INSIGHTS,
  prioritizeDecisionInsights,
} from "../../src/lib/business/insight-prioritization.ts";

function candidate(
  overrides: Partial<DecisionInsightCandidate> & Pick<DecisionInsightCandidate, "id" | "ruleId" | "priority" | "dedupeKey">,
): DecisionInsightCandidate {
  return {
    id: overrides.id,
    ruleId: overrides.ruleId,
    priority: overrides.priority,
    dedupeKey: overrides.dedupeKey,
    severity: overrides.severity ?? "warning",
    domain: overrides.domain ?? "funnel",
    titleAr: overrides.titleAr ?? overrides.id,
    messageAr: overrides.messageAr ?? overrides.id,
    evidence: overrides.evidence ?? [],
    ...(overrides.subjectId ? { subjectId: overrides.subjectId } : {}),
    ...(overrides.subjectName ? { subjectName: overrides.subjectName } : {}),
  };
}

test("Task 28 returns at most أهم 3 ملاحظات in deterministic product-priority order", () => {
  const inputs: DecisionInsightCandidate[] = [
    candidate({
      id: "context",
      ruleId: "rising_cac_lifetime_supported",
      priority: 50,
      dedupeKey: "ultimate-cac-context",
      severity: "context",
      domain: "customer_economics",
    }),
    candidate({
      id: "attendance",
      ruleId: "funnel_attendance_bottleneck",
      priority: 40,
      dedupeKey: "funnel-attendance",
    }),
    candidate({
      id: "cost-pressure",
      ruleId: "non_media_cost_pressure",
      priority: 30,
      dedupeKey: "ultimate-cac",
      domain: "acquisition_cost",
    }),
    candidate({
      id: "weak-lifetime",
      ruleId: "healthy_funnel_weak_lifetime",
      priority: 20,
      dedupeKey: "customer-lifetime-economics",
      severity: "critical",
      domain: "customer_economics",
    }),
    candidate({
      id: "unhealthy-growth",
      ruleId: "unhealthy_growth",
      priority: 10,
      dedupeKey: "profitability-growth",
      severity: "critical",
      domain: "profitability",
    }),
  ];

  const prioritized = prioritizeDecisionInsights(inputs);

  assert.equal(MAX_DECISION_INSIGHTS, 3);
  assert.equal(prioritized.length, 3);
  assert.deepEqual(prioritized.map((insight) => insight.id), [
    "unhealthy-growth",
    "weak-lifetime",
    "cost-pressure",
  ]);
});

test("Task 28 deduplicates the same root cause before applying the Top 3 cap", () => {
  const inputs: DecisionInsightCandidate[] = [
    candidate({
      id: "ultimate-context",
      ruleId: "rising_cac_lifetime_supported",
      priority: 50,
      dedupeKey: "ultimate-cac",
      severity: "context",
      domain: "customer_economics",
    }),
    candidate({
      id: "ultimate-warning",
      ruleId: "non_media_cost_pressure",
      priority: 30,
      dedupeKey: "ultimate-cac",
      domain: "acquisition_cost",
    }),
    candidate({
      id: "profit",
      ruleId: "unhealthy_growth",
      priority: 10,
      dedupeKey: "profitability-growth",
      severity: "critical",
      domain: "profitability",
    }),
  ];

  const prioritized = prioritizeDecisionInsights(inputs);

  assert.deepEqual(prioritized.map((insight) => insight.id), ["profit", "ultimate-warning"]);
  assert.equal(prioritized.some((insight) => insight.id === "ultimate-context"), false);
});

test("Task 28 is independent of input order and uses stable subject-id tie breaking", () => {
  const a = candidate({
    id: "attendance:b",
    ruleId: "funnel_attendance_bottleneck",
    priority: 40,
    dedupeKey: "attendance-b",
    subjectId: "b-funnel",
  });
  const b = candidate({
    id: "attendance:a",
    ruleId: "funnel_attendance_bottleneck",
    priority: 40,
    dedupeKey: "attendance-a",
    subjectId: "a-funnel",
  });
  const c = candidate({
    id: "context",
    ruleId: "rising_cac_lifetime_supported",
    priority: 50,
    dedupeKey: "context",
    severity: "context",
    domain: "customer_economics",
  });

  const forward = prioritizeDecisionInsights([a, b, c]);
  const reversed = prioritizeDecisionInsights([c, b, a]);

  assert.deepEqual(forward.map((insight) => insight.id), ["attendance:a", "attendance:b", "context"]);
  assert.deepEqual(reversed.map((insight) => insight.id), forward.map((insight) => insight.id));
});

test("Task 28 keeps one representative insight when multiple funnels share one attendance root cause", () => {
  const first = candidate({
    id: "attendance:funnel-b",
    ruleId: "funnel_attendance_bottleneck",
    priority: 40,
    dedupeKey: "funnel-attendance",
    subjectId: "funnel-b",
  });
  const second = candidate({
    id: "attendance:funnel-a",
    ruleId: "funnel_attendance_bottleneck",
    priority: 40,
    dedupeKey: "funnel-attendance",
    subjectId: "funnel-a",
  });

  const prioritized = prioritizeDecisionInsights([first, second]);

  assert.equal(prioritized.length, 1);
  assert.equal(prioritized[0]?.subjectId, "funnel-a");
});
