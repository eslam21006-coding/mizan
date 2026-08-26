import type { CoreCalculationResult, ExactRatio } from "./calculations.ts";
import {
  compareDecimalMetrics,
  compareRatioMetrics,
  type MetricComparison,
} from "./comparison.ts";
import {
  DATA_QUALITY_INSUFFICIENT_MESSAGE_AR,
  dataQualitySignalKey,
  evaluateDataQualityDependency,
  type DataQualityProfile,
  type DataQualitySignal,
} from "./data-quality.ts";
import type { FunnelCalculationResult } from "./funnel-calculations.ts";

export const DECISION_INSIGHT_RULE_IDS = [
  "unhealthy_growth",
  "healthy_funnel_weak_lifetime",
  "non_media_cost_pressure",
  "funnel_attendance_bottleneck",
  "rising_cac_lifetime_supported",
] as const;

export type DecisionInsightRuleId = (typeof DECISION_INSIGHT_RULE_IDS)[number];
export type DecisionInsightSeverity = "critical" | "warning" | "context";
export type DecisionInsightDomain =
  | "profitability"
  | "customer_economics"
  | "acquisition_cost"
  | "funnel";

export type DecisionInsightCandidate = {
  id: string;
  ruleId: DecisionInsightRuleId;
  severity: DecisionInsightSeverity;
  domain: DecisionInsightDomain;
  priority: 10 | 20 | 30 | 40 | 50;
  dedupeKey: string;
  titleAr: string;
  messageAr: string;
  evidence: readonly string[];
  subjectId?: string;
  subjectName?: string;
};

export type DecisionRuleEvaluation = {
  ruleId: DecisionInsightRuleId;
  status: "matched" | "not_matched" | "insufficient";
  subjectId?: string;
  blockers: readonly DataQualitySignal[];
  messageAr: string | null;
};

export type DecisionFunnelInput = {
  id: string;
  name?: string;
  metrics: FunnelCalculationResult;
};

export type DecisionCustomerEconomicsInput = {
  lifetimeContributionProfit?: string | null;
};

export type DecisionInsightInput = {
  currentBusiness: CoreCalculationResult | null;
  previousBusiness?: CoreCalculationResult | null;
  dataQuality: DataQualityProfile;
  funnels?: readonly DecisionFunnelInput[];
  customerEconomics?: DecisionCustomerEconomicsInput;
};

export type DecisionInsightResult = {
  candidates: readonly DecisionInsightCandidate[];
  evaluations: readonly DecisionRuleEvaluation[];
  fallbackMessageAr: string | null;
};

type Rational = {
  numerator: bigint;
  denominator: bigint;
};

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;
const SHOW_RATE_THRESHOLD: ExactRatio = { numerator: "65", denominator: "100" };
const CLOSE_RATE_THRESHOLD: ExactRatio = { numerator: "20", denominator: "100" };

export class DecisionInsightInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionInsightInputError";
  }
}

function gcd(left: bigint, right: bigint) {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function normalizeRational(value: Rational): Rational {
  if (value.denominator === 0n) {
    throw new DecisionInsightInputError("Decision ratio denominator cannot be zero.");
  }
  if (value.numerator === 0n) return { numerator: 0n, denominator: 1n };

  const sign = value.denominator < 0n ? -1n : 1n;
  const numerator = value.numerator * sign;
  const denominator = value.denominator * sign;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function ratioRational(value: ExactRatio): Rational {
  return normalizeRational({
    numerator: BigInt(value.numerator),
    denominator: BigInt(value.denominator),
  });
}

function compareRationals(left: Rational, right: Rational) {
  const leftScaled = left.numerator * right.denominator;
  const rightScaled = right.numerator * left.denominator;
  return leftScaled === rightScaled ? 0 : leftScaled > rightScaled ? 1 : -1;
}

function compareRatios(left: ExactRatio, right: ExactRatio) {
  return compareRationals(ratioRational(left), ratioRational(right));
}

function decimalSign(value: string) {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new DecisionInsightInputError("Lifetime Contribution Profit must be a canonical decimal string.");
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const coefficient = BigInt(`${whole}${fraction}` || "0") * (negative ? -1n : 1n);
  return coefficient === 0n ? 0 : coefficient > 0n ? 1 : -1;
}

function unavailableEvaluation(
  ruleId: DecisionInsightRuleId,
  blockers: readonly DataQualitySignal[],
  subjectId?: string,
): DecisionRuleEvaluation {
  return {
    ruleId,
    status: "insufficient",
    ...(subjectId ? { subjectId } : {}),
    blockers,
    messageAr: DATA_QUALITY_INSUFFICIENT_MESSAGE_AR,
  };
}

function matchedEvaluation(
  ruleId: DecisionInsightRuleId,
  subjectId?: string,
): DecisionRuleEvaluation {
  return {
    ruleId,
    status: "matched",
    ...(subjectId ? { subjectId } : {}),
    blockers: [],
    messageAr: null,
  };
}

function notMatchedEvaluation(
  ruleId: DecisionInsightRuleId,
  subjectId?: string,
): DecisionRuleEvaluation {
  return {
    ruleId,
    status: "not_matched",
    ...(subjectId ? { subjectId } : {}),
    blockers: [],
    messageAr: null,
  };
}

function comparisonDirection(comparison: MetricComparison) {
  return comparison.available ? comparison.direction : null;
}

function evaluateUnhealthyGrowth(
  input: DecisionInsightInput,
  candidates: DecisionInsightCandidate[],
  evaluations: DecisionRuleEvaluation[],
) {
  const ruleId: DecisionInsightRuleId = "unhealthy_growth";
  const quality = evaluateDataQualityDependency(input.dataQuality, {
    id: ruleId,
    requiredAll: [
      dataQualitySignalKey.business("current", "net_cash_collected"),
      dataQualitySignalKey.business("previous", "net_cash_collected"),
      dataQualitySignalKey.business("current", "real_net_profit"),
      dataQualitySignalKey.business("previous", "real_net_profit"),
    ],
  });
  if (!quality.ready || !input.currentBusiness || !input.previousBusiness) {
    evaluations.push(unavailableEvaluation(ruleId, quality.blockers));
    return;
  }

  const netCash = compareDecimalMetrics(
    input.currentBusiness.netCashCollected,
    input.previousBusiness.netCashCollected,
  );
  const profit = compareDecimalMetrics(
    input.currentBusiness.realNetProfit,
    input.previousBusiness.realNetProfit,
  );
  const matched = comparisonDirection(netCash) === "up" && comparisonDirection(profit) === "down";
  evaluations.push(matched ? matchedEvaluation(ruleId) : notMatchedEvaluation(ruleId));
  if (!matched) return;

  candidates.push({
    id: ruleId,
    ruleId,
    severity: "critical",
    domain: "profitability",
    priority: 10,
    dedupeKey: "profitability-growth",
    titleAr: "النمو الحالي يضغط على الربح",
    messageAr:
      "صافي التحصيل النقدي ارتفع مقارنة بالفترة السابقة، بينما انخفض صافي الربح الحقيقي. هذا نمو غير صحي ويحتاج مراجعة التكاليف قبل زيادة الإنفاق.",
    evidence: ["net_cash_collected:up", "real_net_profit:down"],
  });
}

function evaluateNonMediaCostPressure(
  input: DecisionInsightInput,
  candidates: DecisionInsightCandidate[],
  evaluations: DecisionRuleEvaluation[],
) {
  const ruleId: DecisionInsightRuleId = "non_media_cost_pressure";
  const quality = evaluateDataQualityDependency(input.dataQuality, {
    id: ruleId,
    requiredAll: [
      dataQualitySignalKey.business("current", "media_cac"),
      dataQualitySignalKey.business("previous", "media_cac"),
      dataQualitySignalKey.business("current", "ultimate_cac"),
      dataQualitySignalKey.business("previous", "ultimate_cac"),
      dataQualitySignalKey.adSpendReconciliation,
    ],
  });
  if (!quality.ready || !input.currentBusiness || !input.previousBusiness) {
    evaluations.push(unavailableEvaluation(ruleId, quality.blockers));
    return;
  }

  const mediaCac = compareRatioMetrics(input.currentBusiness.mediaCac, input.previousBusiness.mediaCac);
  const ultimateCac = compareRatioMetrics(
    input.currentBusiness.ultimateCac,
    input.previousBusiness.ultimateCac,
  );
  // V1 intentionally defines "stable" as exactly unchanged. No tolerance band is invented.
  const matched =
    comparisonDirection(mediaCac) === "flat" && comparisonDirection(ultimateCac) === "up";
  evaluations.push(matched ? matchedEvaluation(ruleId) : notMatchedEvaluation(ruleId));
  if (!matched) return;

  candidates.push({
    id: ruleId,
    ruleId,
    severity: "warning",
    domain: "acquisition_cost",
    priority: 30,
    dedupeKey: "ultimate-cac",
    titleAr: "التكلفة خارج الإعلانات ترتفع",
    messageAr:
      "تكلفة الإعلانات لكل عميل جديد (Media CAC) لم تتغير، بينما ارتفعت التكلفة الكاملة للبزنس لكل عميل جديد (Ultimate CAC). راجع تكاليف التنفيذ والمصاريف الإدارية والمالية وتكاليف الاستحواذ غير الإعلامية.",
    evidence: ["media_cac:flat_exact", "ultimate_cac:up", "ad_spend_reconciliation:ready"],
  });
}

function evaluateRisingCacLifetimeSupported(
  input: DecisionInsightInput,
  candidates: DecisionInsightCandidate[],
  evaluations: DecisionRuleEvaluation[],
) {
  const ruleId: DecisionInsightRuleId = "rising_cac_lifetime_supported";
  const quality = evaluateDataQualityDependency(input.dataQuality, {
    id: ruleId,
    requiredAll: [
      dataQualitySignalKey.business("current", "ultimate_cac"),
      dataQualitySignalKey.business("previous", "ultimate_cac"),
      dataQualitySignalKey.customer("lifetime_contribution_profit"),
    ],
  });
  const lifetimeContributionProfit = input.customerEconomics?.lifetimeContributionProfit;
  if (
    !quality.ready ||
    !input.currentBusiness ||
    !input.previousBusiness ||
    lifetimeContributionProfit === null ||
    lifetimeContributionProfit === undefined
  ) {
    evaluations.push(unavailableEvaluation(ruleId, quality.blockers));
    return;
  }

  const ultimateCac = compareRatioMetrics(
    input.currentBusiness.ultimateCac,
    input.previousBusiness.ultimateCac,
  );
  const matched =
    comparisonDirection(ultimateCac) === "up" && decimalSign(lifetimeContributionProfit) > 0;
  evaluations.push(matched ? matchedEvaluation(ruleId) : notMatchedEvaluation(ruleId));
  if (!matched) return;

  candidates.push({
    id: ruleId,
    ruleId,
    severity: "context",
    domain: "customer_economics",
    priority: 50,
    dedupeKey: "ultimate-cac",
    titleAr: "ارتفاع التكلفة لا يعني وحده أن الاستحواذ سيئ",
    messageAr:
      "التكلفة الكاملة للبزنس لكل عميل جديد ارتفعت، لكن ربح المساهمة مدى الحياة للعملاء ما زال موجباً. لا تصنف الاستحواذ على أنه غير صحي من ارتفاع التكلفة وحده.",
    evidence: ["ultimate_cac:up", "lifetime_contribution_profit:positive"],
  });
}

function evaluateAttendanceBottlenecks(
  input: DecisionInsightInput,
  candidates: DecisionInsightCandidate[],
  evaluations: DecisionRuleEvaluation[],
) {
  const ruleId: DecisionInsightRuleId = "funnel_attendance_bottleneck";
  for (const funnel of input.funnels ?? []) {
    const quality = evaluateDataQualityDependency(input.dataQuality, {
      id: `${ruleId}:${funnel.id}`,
      subjectId: funnel.id,
      requiredAll: [
        dataQualitySignalKey.funnel(funnel.id, "show_rate"),
        dataQualitySignalKey.funnel(funnel.id, "close_rate"),
      ],
    });
    if (!quality.ready || !funnel.metrics.showRate.available || !funnel.metrics.closeRate.available) {
      evaluations.push(unavailableEvaluation(ruleId, quality.blockers, funnel.id));
      continue;
    }

    const showBelow65 = compareRatios(funnel.metrics.showRate.value, SHOW_RATE_THRESHOLD) < 0;
    const closeAbove20 = compareRatios(funnel.metrics.closeRate.value, CLOSE_RATE_THRESHOLD) > 0;
    const matched = showBelow65 && closeAbove20;
    evaluations.push(matched ? matchedEvaluation(ruleId, funnel.id) : notMatchedEvaluation(ruleId, funnel.id));
    if (!matched) continue;

    const subjectLabel = funnel.name?.trim() || "هذا الفانل";
    candidates.push({
      id: `${ruleId}:${funnel.id}`,
      ruleId,
      severity: "warning",
      domain: "funnel",
      priority: 40,
      dedupeKey: "funnel-attendance",
      titleAr: "الحضور هو الاختناق الأوضح",
      messageAr: `نسبة الحضور في ${subjectLabel} أقل من 65% بينما نسبة الإغلاق أعلى من 20%. تحسين الحضور هو على الأرجح الاختناق الأكبر قبل محاولة رفع الإغلاق.`,
      evidence: ["show_rate:<65%", "close_rate:>20%"],
      subjectId: funnel.id,
      ...(funnel.name?.trim() ? { subjectName: funnel.name.trim() } : {}),
    });
  }
}

function evaluateHealthyFunnelWeakLifetime(
  input: DecisionInsightInput,
  candidates: DecisionInsightCandidate[],
  evaluations: DecisionRuleEvaluation[],
) {
  const ruleId: DecisionInsightRuleId = "healthy_funnel_weak_lifetime";
  const lifetimeContributionProfit = input.customerEconomics?.lifetimeContributionProfit;

  for (const funnel of input.funnels ?? []) {
    const quality = evaluateDataQualityDependency(input.dataQuality, {
      id: `${ruleId}:${funnel.id}`,
      subjectId: funnel.id,
      requiredAll: [
        dataQualitySignalKey.funnel(funnel.id, "show_rate"),
        dataQualitySignalKey.funnel(funnel.id, "close_rate"),
        dataQualitySignalKey.customer("lifetime_contribution_profit"),
      ],
    });
    if (
      !quality.ready ||
      !funnel.metrics.showRate.available ||
      !funnel.metrics.closeRate.available ||
      lifetimeContributionProfit === null ||
      lifetimeContributionProfit === undefined
    ) {
      evaluations.push(unavailableEvaluation(ruleId, quality.blockers, funnel.id));
      continue;
    }

    const showHealthy = compareRatios(funnel.metrics.showRate.value, SHOW_RATE_THRESHOLD) > 0;
    const closeHealthy = compareRatios(funnel.metrics.closeRate.value, CLOSE_RATE_THRESHOLD) > 0;
    const lifetimeWeak = decimalSign(lifetimeContributionProfit) < 0;
    const matched = showHealthy && closeHealthy && lifetimeWeak;
    evaluations.push(matched ? matchedEvaluation(ruleId, funnel.id) : notMatchedEvaluation(ruleId, funnel.id));
    if (!matched) continue;

    candidates.push({
      id: `${ruleId}:${funnel.id}`,
      ruleId,
      severity: "critical",
      domain: "customer_economics",
      priority: 20,
      dedupeKey: "customer-lifetime-economics",
      titleAr: "التحويل جيد لكن اقتصاديات العميل ضعيفة",
      messageAr:
        "هناك فانل تتجاوز فيه نسبة الحضور 65% ونسبة الإغلاق 20%، لكن ربح المساهمة مدى الحياة سلبي. افحص الترقيات والتجديدات والإيرادات الخلفية (Backend) والتسعير والاحتفاظ بالعميل.",
      evidence: ["show_rate:>65%", "close_rate:>20%", "lifetime_contribution_profit:negative"],
      subjectId: funnel.id,
      ...(funnel.name?.trim() ? { subjectName: funnel.name.trim() } : {}),
    });
  }
}

export function generateRuleBasedInsights(input: DecisionInsightInput): DecisionInsightResult {
  const candidates: DecisionInsightCandidate[] = [];
  const evaluations: DecisionRuleEvaluation[] = [];

  evaluateUnhealthyGrowth(input, candidates, evaluations);
  evaluateHealthyFunnelWeakLifetime(input, candidates, evaluations);
  evaluateNonMediaCostPressure(input, candidates, evaluations);
  evaluateAttendanceBottlenecks(input, candidates, evaluations);
  evaluateRisingCacLifetimeSupported(input, candidates, evaluations);

  return {
    candidates,
    evaluations,
    fallbackMessageAr:
      candidates.length === 0 && evaluations.some((evaluation) => evaluation.status === "insufficient")
        ? DATA_QUALITY_INSUFFICIENT_MESSAGE_AR
        : null,
  };
}
