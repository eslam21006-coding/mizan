import type { CalculatedMetric, ExactRatio } from "./calculations";
import { compareDecimalMetrics, compareRatioMetrics } from "./comparison";
import {
  compareRationals,
  rationalFromExactRatio,
} from "./exact-rational";
import type { FunnelHealth, FunnelMetric } from "./funnel-calculations";

export type CoachFinancialSnapshot = {
  netCashCollected: CalculatedMetric<string>;
  realNetProfit: CalculatedMetric<string>;
  realNetProfitMargin: CalculatedMetric<ExactRatio>;
  ultimateCac: CalculatedMetric<ExactRatio>;
};

export type CoachFunnelSnapshot = {
  funnelId: string;
  funnelName: string;
  showRate: FunnelMetric<ExactRatio>;
  closeRate: FunnelMetric<ExactRatio>;
  showRateHealth: FunnelHealth;
  closeRateHealth: FunnelHealth;
};

export type CoachBusinessSnapshot = {
  menteeUserId: string;
  menteeEmail: string | null;
  businessId: string;
  businessName: string;
  currentMonth: string;
  previousMonth: string;
  currentFinancial: CoachFinancialSnapshot | null;
  previousFinancial: CoachFinancialSnapshot | null;
  currentFunnels: CoachFunnelSnapshot[];
  previousFunnels: CoachFunnelSnapshot[];
};

export type CoachAttentionCode =
  | "UNHEALTHY_GROWTH"
  | "PROFIT_FALLING"
  | "MARGIN_DECLINING"
  | "ULTIMATE_CAC_RISING"
  | "SHOW_RATE_UNHEALTHY"
  | "CLOSE_RATE_UNHEALTHY";

export type CoachImprovementCode =
  | "PROFIT_IMPROVING"
  | "MARGIN_IMPROVING"
  | "ULTIMATE_CAC_IMPROVING"
  | "FUNNEL_METRICS_IMPROVING";

export type CoachSignalCode = CoachAttentionCode | CoachImprovementCode;

export type CoachDashboardSignal = {
  kind: "attention" | "improvement";
  code: CoachSignalCode;
  priority: number;
  menteeUserId: string;
  menteeEmail: string | null;
  businessId: string;
  businessName: string;
  currentMonth: string;
  previousMonth: string;
  titleAr: string;
  detailAr: string;
};

export type CoachDashboardFeed = {
  attention: CoachDashboardSignal[];
  improvements: CoachDashboardSignal[];
  evaluatedBusinesses: number;
  insufficientBusinesses: number;
};

const MAX_SIGNALS_PER_SECTION = 6;

function baseSignal(snapshot: CoachBusinessSnapshot) {
  return {
    menteeUserId: snapshot.menteeUserId,
    menteeEmail: snapshot.menteeEmail,
    businessId: snapshot.businessId,
    businessName: snapshot.businessName,
    currentMonth: snapshot.currentMonth,
    previousMonth: snapshot.previousMonth,
  };
}

function attentionSignal(
  snapshot: CoachBusinessSnapshot,
  code: CoachAttentionCode,
  priority: number,
  titleAr: string,
  detailAr: string,
): CoachDashboardSignal {
  return {
    kind: "attention",
    code,
    priority,
    ...baseSignal(snapshot),
    titleAr,
    detailAr,
  };
}

function improvementSignal(
  snapshot: CoachBusinessSnapshot,
  code: CoachImprovementCode,
  priority: number,
  titleAr: string,
  detailAr: string,
): CoachDashboardSignal {
  return {
    kind: "improvement",
    code,
    priority,
    ...baseSignal(snapshot),
    titleAr,
    detailAr,
  };
}

function compareFunnelRatio(
  current: FunnelMetric<ExactRatio>,
  previous: FunnelMetric<ExactRatio>,
) {
  if (!current.available || !previous.available) return null;
  return compareRationals(
    rationalFromExactRatio(current.value),
    rationalFromExactRatio(previous.value),
  );
}

function firstCurrentFunnel(
  snapshot: CoachBusinessSnapshot,
  predicate: (funnel: CoachFunnelSnapshot) => boolean,
) {
  return [...snapshot.currentFunnels]
    .sort((left, right) => left.funnelId.localeCompare(right.funnelId))
    .find(predicate);
}

function firstImprovedFunnel(snapshot: CoachBusinessSnapshot) {
  const previousById = new Map(snapshot.previousFunnels.map((funnel) => [funnel.funnelId, funnel]));

  for (const current of [...snapshot.currentFunnels].sort((left, right) =>
    left.funnelId.localeCompare(right.funnelId),
  )) {
    const previous = previousById.get(current.funnelId);
    if (!previous) continue;

    const showDirection = compareFunnelRatio(current.showRate, previous.showRate);
    if (showDirection !== null && showDirection > 0) {
      return { funnel: current, metric: "Show Rate" as const };
    }

    const closeDirection = compareFunnelRatio(current.closeRate, previous.closeRate);
    if (closeDirection !== null && closeDirection > 0) {
      return { funnel: current, metric: "Close Rate" as const };
    }
  }

  return null;
}

function evaluateAttention(snapshot: CoachBusinessSnapshot) {
  const current = snapshot.currentFinancial;
  const previous = snapshot.previousFinancial;
  const candidates: CoachDashboardSignal[] = [];

  if (current && previous) {
    const revenue = compareDecimalMetrics(current.netCashCollected, previous.netCashCollected);
    const profit = compareDecimalMetrics(current.realNetProfit, previous.realNetProfit);
    const margin = compareRatioMetrics(current.realNetProfitMargin, previous.realNetProfitMargin);
    const ultimateCac = compareRatioMetrics(current.ultimateCac, previous.ultimateCac);

    if (
      revenue.available &&
      revenue.direction === "up" &&
      profit.available &&
      profit.direction === "down"
    ) {
      candidates.push(
        attentionSignal(
          snapshot,
          "UNHEALTHY_GROWTH",
          100,
          "الإيراد يرتفع لكن الربح ينخفض",
          "صافي الكاش المحصل ارتفع مقارنة بالشهر السابق، بينما انخفض صافي الربح الحقيقي.",
        ),
      );
    }

    if (profit.available && profit.direction === "down") {
      candidates.push(
        attentionSignal(
          snapshot,
          "PROFIT_FALLING",
          90,
          "صافي الربح يتراجع",
          "صافي الربح الحقيقي أقل من الشهر السابق.",
        ),
      );
    }

    if (margin.available && margin.direction === "down") {
      candidates.push(
        attentionSignal(
          snapshot,
          "MARGIN_DECLINING",
          80,
          "هامش صافي الربح يتراجع",
          "هامش صافي الربح الحقيقي أقل من الشهر السابق.",
        ),
      );
    }

    if (ultimateCac.available && ultimateCac.direction === "up") {
      candidates.push(
        attentionSignal(
          snapshot,
          "ULTIMATE_CAC_RISING",
          70,
          "Ultimate CAC يرتفع",
          "التكلفة الكاملة للبزنس لكل عميل جديد أعلى من الشهر السابق.",
        ),
      );
    }
  }

  const unhealthyShow = firstCurrentFunnel(
    snapshot,
    (funnel) => funnel.showRateHealth === "below_benchmark",
  );
  if (unhealthyShow) {
    candidates.push(
      attentionSignal(
        snapshot,
        "SHOW_RATE_UNHEALTHY",
        60,
        "Show Rate غير صحي",
        `${unhealthyShow.funnelName}: نسبة الحضور لا تتجاوز معيار Mizan الصحي (>65%).`,
      ),
    );
  }

  const unhealthyClose = firstCurrentFunnel(
    snapshot,
    (funnel) => funnel.closeRateHealth === "below_benchmark",
  );
  if (unhealthyClose) {
    candidates.push(
      attentionSignal(
        snapshot,
        "CLOSE_RATE_UNHEALTHY",
        50,
        "Close Rate غير صحي",
        `${unhealthyClose.funnelName}: نسبة الإغلاق لا تتجاوز معيار Mizan الصحي (>20%).`,
      ),
    );
  }

  return candidates.sort((left, right) => right.priority - left.priority)[0] ?? null;
}

function evaluateImprovement(snapshot: CoachBusinessSnapshot) {
  const current = snapshot.currentFinancial;
  const previous = snapshot.previousFinancial;
  const candidates: CoachDashboardSignal[] = [];

  if (current && previous) {
    const profit = compareDecimalMetrics(current.realNetProfit, previous.realNetProfit);
    const margin = compareRatioMetrics(current.realNetProfitMargin, previous.realNetProfitMargin);
    const ultimateCac = compareRatioMetrics(current.ultimateCac, previous.ultimateCac);

    if (profit.available && profit.direction === "up") {
      candidates.push(
        improvementSignal(
          snapshot,
          "PROFIT_IMPROVING",
          90,
          "صافي الربح يتحسن",
          "صافي الربح الحقيقي أعلى من الشهر السابق.",
        ),
      );
    }

    if (margin.available && margin.direction === "up") {
      candidates.push(
        improvementSignal(
          snapshot,
          "MARGIN_IMPROVING",
          80,
          "هامش صافي الربح يتحسن",
          "هامش صافي الربح الحقيقي أعلى من الشهر السابق.",
        ),
      );
    }

    if (ultimateCac.available && ultimateCac.direction === "down") {
      candidates.push(
        improvementSignal(
          snapshot,
          "ULTIMATE_CAC_IMPROVING",
          70,
          "Ultimate CAC يتحسن",
          "التكلفة الكاملة للبزنس لكل عميل جديد أقل من الشهر السابق.",
        ),
      );
    }
  }

  const improvedFunnel = firstImprovedFunnel(snapshot);
  if (improvedFunnel) {
    candidates.push(
      improvementSignal(
        snapshot,
        "FUNNEL_METRICS_IMPROVING",
        60,
        "مؤشرات الفانل تتحسن",
        `${improvedFunnel.funnel.funnelName}: تحسن ${improvedFunnel.metric} مقارنة بالشهر السابق.`,
      ),
    );
  }

  return candidates.sort((left, right) => right.priority - left.priority)[0] ?? null;
}

function stableSignalSort(left: CoachDashboardSignal, right: CoachDashboardSignal) {
  if (left.priority !== right.priority) return right.priority - left.priority;
  const emailOrder = (left.menteeEmail ?? "").localeCompare(right.menteeEmail ?? "", "en");
  if (emailOrder !== 0) return emailOrder;
  const businessOrder = left.businessName.localeCompare(right.businessName, "ar");
  if (businessOrder !== 0) return businessOrder;
  return left.businessId.localeCompare(right.businessId);
}

export function buildCoachDashboardFeed(
  snapshots: readonly CoachBusinessSnapshot[],
): CoachDashboardFeed {
  const attention: CoachDashboardSignal[] = [];
  const improvements: CoachDashboardSignal[] = [];
  let insufficientBusinesses = 0;

  for (const snapshot of snapshots) {
    const attentionSignalForBusiness = evaluateAttention(snapshot);
    const improvementSignalForBusiness = evaluateImprovement(snapshot);

    if (attentionSignalForBusiness) attention.push(attentionSignalForBusiness);
    if (improvementSignalForBusiness) improvements.push(improvementSignalForBusiness);
    if (!attentionSignalForBusiness && !improvementSignalForBusiness) insufficientBusinesses += 1;
  }

  return {
    attention: attention.sort(stableSignalSort).slice(0, MAX_SIGNALS_PER_SECTION),
    improvements: improvements.sort(stableSignalSort).slice(0, MAX_SIGNALS_PER_SECTION),
    evaluatedBusinesses: snapshots.length,
    insufficientBusinesses,
  };
}
