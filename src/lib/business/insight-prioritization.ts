import type { DecisionInsightCandidate } from "./decision-insights";

export const MAX_DECISION_INSIGHTS = 3;

function stableCompare(left: DecisionInsightCandidate, right: DecisionInsightCandidate) {
  if (left.priority !== right.priority) return left.priority - right.priority;

  const ruleOrder = left.ruleId.localeCompare(right.ruleId, "en");
  if (ruleOrder !== 0) return ruleOrder;

  const subjectOrder = (left.subjectId ?? "").localeCompare(right.subjectId ?? "", "en");
  if (subjectOrder !== 0) return subjectOrder;

  return left.id.localeCompare(right.id, "en");
}

export function prioritizeDecisionInsights(
  candidates: readonly DecisionInsightCandidate[],
): readonly DecisionInsightCandidate[] {
  const sorted = [...candidates].sort(stableCompare);
  const seenRootCauses = new Set<string>();
  const prioritized: DecisionInsightCandidate[] = [];

  for (const candidate of sorted) {
    if (seenRootCauses.has(candidate.dedupeKey)) continue;
    seenRootCauses.add(candidate.dedupeKey);
    prioritized.push(candidate);
    if (prioritized.length === MAX_DECISION_INSIGHTS) break;
  }

  return prioritized;
}
