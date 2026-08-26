import type {
  CalculatedMetric,
  CalculationUnavailableReason,
  CoreCalculationResult,
} from "./calculations";
import type {
  AdSpendReconciliationResult,
  FunnelCalculationResult,
  FunnelMetric,
  FunnelMetricUnavailableReason,
} from "./funnel-calculations";

export const DATA_QUALITY_INSUFFICIENT_MESSAGE_AR = "البيانات غير كافية للحكم";

export type DataQualityState =
  | "ready"
  | "missing"
  | "attribution_missing"
  | "known_zero"
  | "known_value_blocker"
  | "conflict"
  | "incomplete";

export type DataQualityReasonCode =
  | "INPUT_UNAVAILABLE"
  | "ATTRIBUTION_UNAVAILABLE"
  | "KNOWN_ZERO_DENOMINATOR"
  | "KNOWN_VALUE_CANNOT_SUPPORT_METRIC"
  | "AD_SPEND_RECONCILIATION_MISMATCH"
  | "AD_SPEND_RECONCILIATION_INCOMPLETE"
  | "CUSTOMER_ECONOMICS_INCOMPLETE"
  | "CUSTOMER_ECONOMICS_CONFLICT"
  | "SIGNAL_NOT_PROVIDED"
  | "INVALID_DEPENDENCY";

export type DataQualitySource =
  | "business_current"
  | "business_previous"
  | "ad_spend_reconciliation"
  | "funnel"
  | "customer_economics"
  | "dependency";

export type DataQualitySignal = {
  key: string;
  state: DataQualityState;
  source: DataQualitySource;
  reasonCode: DataQualityReasonCode | null;
  sourceReason?: string;
  subjectId?: string;
  subjectName?: string;
};

export type ExternalDataQualitySignal = {
  state: "ready" | "missing" | "attribution_missing" | "conflict" | "incomplete";
  sourceReason?: string;
};

export type CustomerEconomicsDataQualityInput = {
  observedLtv?: ExternalDataQualitySignal;
  backendLifetimeRevenue?: ExternalDataQualitySignal;
  lifetimeRevenueAttribution?: ExternalDataQualitySignal;
  lifetimeContributionProfit?: ExternalDataQualitySignal;
};

export type FunnelDataQualityInput = {
  id: string;
  name?: string;
  metrics: FunnelCalculationResult;
};

export type DecisionDataQualityInput = {
  currentBusiness: CoreCalculationResult | null;
  previousBusiness?: CoreCalculationResult | null;
  adSpendReconciliation?: Pick<AdSpendReconciliationResult, "status"> | null;
  funnels?: readonly FunnelDataQualityInput[];
  customerEconomics?: CustomerEconomicsDataQualityInput;
};

export type DataQualityProfile = {
  signals: Readonly<Record<string, DataQualitySignal>>;
  blockingSignals: readonly DataQualitySignal[];
};

export type DataQualityDependency = {
  id: string;
  subjectId?: string;
  requiredAll?: readonly string[];
  requiredAny?: readonly (readonly string[])[];
};

export type DataQualityDependencyResult = {
  id: string;
  subjectId?: string;
  ready: boolean;
  blockers: readonly DataQualitySignal[];
  messageAr: string | null;
};

export type DataQualityReadinessSummary = {
  status: "ready" | "partial" | "insufficient";
  results: readonly DataQualityDependencyResult[];
};

export const BUSINESS_DATA_QUALITY_METRICS = [
  "gross_cash_collected",
  "refunds",
  "net_cash_collected",
  "new_customers",
  "total_paying_customers",
  "returning_customers",
  "all_business_costs",
  "variable_costs",
  "real_net_profit",
  "real_net_profit_margin",
  "contribution_profit",
  "contribution_margin",
  "media_cac",
  "acquisition_cac",
  "ultimate_cac",
  "revenue_per_paying_customer",
  "revenue_per_new_customer",
  "mer",
  "roas",
] as const;

export type BusinessDataQualityMetric = (typeof BUSINESS_DATA_QUALITY_METRICS)[number];

export const FUNNEL_DATA_QUALITY_METRICS = [
  "cpl",
  "cost_per_booking",
  "cost_per_show",
  "cost_per_qualified_call",
  "show_rate",
  "qualification_rate",
  "close_rate",
  "lead_to_sale_rate",
  "media_cac",
  "roas",
] as const;

export type FunnelDataQualityMetric = (typeof FUNNEL_DATA_QUALITY_METRICS)[number];

export const CUSTOMER_DATA_QUALITY_METRICS = [
  "observed_ltv",
  "backend_lifetime_revenue",
  "lifetime_revenue_attribution",
  "lifetime_contribution_profit",
] as const;

export type CustomerDataQualityMetric = (typeof CUSTOMER_DATA_QUALITY_METRICS)[number];

export const dataQualitySignalKey = {
  business(period: "current" | "previous", metric: BusinessDataQualityMetric) {
    return `business.${period}.${metric}`;
  },
  adSpendReconciliation: "business.ad_spend_reconciliation",
  funnel(funnelId: string, metric: FunnelDataQualityMetric) {
    return `funnel.${funnelId}.${metric}`;
  },
  customer(metric: CustomerDataQualityMetric) {
    return `customer.${metric}`;
  },
} as const;

type AvailabilityMetric =
  | CalculatedMetric<unknown>
  | FunnelMetric<unknown>;

type BusinessMetricProperty = Exclude<
  keyof CoreCalculationResult,
  "revenueByStream" | "expensesByItem" | "expensesByCategory"
>;

const BUSINESS_METRIC_PROPERTIES: Record<BusinessDataQualityMetric, BusinessMetricProperty> = {
  gross_cash_collected: "grossCashCollected",
  refunds: "refunds",
  net_cash_collected: "netCashCollected",
  new_customers: "newCustomers",
  total_paying_customers: "totalPayingCustomers",
  returning_customers: "returningCustomers",
  all_business_costs: "allBusinessCosts",
  variable_costs: "variableCosts",
  real_net_profit: "realNetProfit",
  real_net_profit_margin: "realNetProfitMargin",
  contribution_profit: "contributionProfit",
  contribution_margin: "contributionMargin",
  media_cac: "mediaCac",
  acquisition_cac: "acquisitionCac",
  ultimate_cac: "ultimateCac",
  revenue_per_paying_customer: "revenuePerPayingCustomer",
  revenue_per_new_customer: "revenuePerNewCustomer",
  mer: "mer",
  roas: "roas",
};

type FunnelMetricProperty = Exclude<
  keyof FunnelCalculationResult,
  "showRateHealth" | "closeRateHealth"
>;

const FUNNEL_METRIC_PROPERTIES: Record<FunnelDataQualityMetric, FunnelMetricProperty> = {
  cpl: "cpl",
  cost_per_booking: "costPerBooking",
  cost_per_show: "costPerShow",
  cost_per_qualified_call: "costPerQualifiedCall",
  show_rate: "showRate",
  qualification_rate: "qualificationRate",
  close_rate: "closeRate",
  lead_to_sale_rate: "leadToSaleRate",
  media_cac: "mediaCac",
  roas: "roas",
};

const CUSTOMER_INPUT_PROPERTIES: Record<
  CustomerDataQualityMetric,
  keyof CustomerEconomicsDataQualityInput
> = {
  observed_ltv: "observedLtv",
  backend_lifetime_revenue: "backendLifetimeRevenue",
  lifetime_revenue_attribution: "lifetimeRevenueAttribution",
  lifetime_contribution_profit: "lifetimeContributionProfit",
};

function readySignal(
  key: string,
  source: DataQualitySource,
  subject?: { id?: string; name?: string },
): DataQualitySignal {
  return {
    key,
    state: "ready",
    source,
    reasonCode: null,
    ...(subject?.id ? { subjectId: subject.id } : {}),
    ...(subject?.name ? { subjectName: subject.name } : {}),
  };
}

function unavailableState(reason: CalculationUnavailableReason | FunnelMetricUnavailableReason) {
  if (reason === "INPUT_UNAVAILABLE") {
    return { state: "missing", reasonCode: "INPUT_UNAVAILABLE" } as const;
  }
  if (reason === "ATTRIBUTION_UNAVAILABLE") {
    return { state: "attribution_missing", reasonCode: "ATTRIBUTION_UNAVAILABLE" } as const;
  }
  if (
    reason === "NO_NEW_CUSTOMERS" ||
    reason === "NO_PAYING_CUSTOMERS" ||
    reason === "NO_AD_SPEND" ||
    reason === "NO_LEADS" ||
    reason === "NO_BOOKED_CALLS" ||
    reason === "NO_SHOWED_CALLS" ||
    reason === "NO_QUALIFIED_CALLS"
  ) {
    return { state: "known_zero", reasonCode: "KNOWN_ZERO_DENOMINATOR" } as const;
  }
  return {
    state: "known_value_blocker",
    reasonCode: "KNOWN_VALUE_CANNOT_SUPPORT_METRIC",
  } as const;
}

function signalFromMetric(
  key: string,
  source: DataQualitySource,
  metric: AvailabilityMetric,
  subject?: { id?: string; name?: string },
): DataQualitySignal {
  if (metric.available) return readySignal(key, source, subject);
  const mapped = unavailableState(metric.reason);
  return {
    key,
    source,
    ...mapped,
    sourceReason: metric.reason,
    ...(subject?.id ? { subjectId: subject.id } : {}),
    ...(subject?.name ? { subjectName: subject.name } : {}),
  };
}

function missingSignal(key: string, source: DataQualitySource): DataQualitySignal {
  return {
    key,
    state: "missing",
    source,
    reasonCode: "SIGNAL_NOT_PROVIDED",
  };
}

function invalidDependencySignal(key: string): DataQualitySignal {
  return {
    key,
    state: "incomplete",
    source: "dependency",
    reasonCode: "INVALID_DEPENDENCY",
    sourceReason: "requiredAny group must contain at least one signal key.",
  };
}

function addBusinessSignals(
  target: Record<string, DataQualitySignal>,
  period: "current" | "previous",
  result: CoreCalculationResult | null | undefined,
) {
  const source: DataQualitySource = period === "current" ? "business_current" : "business_previous";
  for (const metric of BUSINESS_DATA_QUALITY_METRICS) {
    const key = dataQualitySignalKey.business(period, metric);
    if (!result) {
      target[key] = missingSignal(key, source);
      continue;
    }
    target[key] = signalFromMetric(
      key,
      source,
      result[BUSINESS_METRIC_PROPERTIES[metric]] as AvailabilityMetric,
    );
  }
}

function addAdSpendReconciliationSignal(
  target: Record<string, DataQualitySignal>,
  reconciliation: Pick<AdSpendReconciliationResult, "status"> | null | undefined,
) {
  const key = dataQualitySignalKey.adSpendReconciliation;
  if (!reconciliation) {
    target[key] = missingSignal(key, "ad_spend_reconciliation");
    return;
  }

  if (
    reconciliation.status === "matched" ||
    reconciliation.status === "business_only" ||
    reconciliation.status === "funnel_only"
  ) {
    target[key] = readySignal(key, "ad_spend_reconciliation");
    return;
  }

  if (reconciliation.status === "mismatch") {
    target[key] = {
      key,
      state: "conflict",
      source: "ad_spend_reconciliation",
      reasonCode: "AD_SPEND_RECONCILIATION_MISMATCH",
      sourceReason: reconciliation.status,
    };
    return;
  }

  target[key] = {
    key,
    state: "incomplete",
    source: "ad_spend_reconciliation",
    reasonCode: "AD_SPEND_RECONCILIATION_INCOMPLETE",
    sourceReason: reconciliation.status,
  };
}

function addFunnelSignals(
  target: Record<string, DataQualitySignal>,
  funnels: readonly FunnelDataQualityInput[],
) {
  for (const funnel of funnels) {
    for (const metric of FUNNEL_DATA_QUALITY_METRICS) {
      const key = dataQualitySignalKey.funnel(funnel.id, metric);
      target[key] = signalFromMetric(
        key,
        "funnel",
        funnel.metrics[FUNNEL_METRIC_PROPERTIES[metric]] as AvailabilityMetric,
        { id: funnel.id, name: funnel.name },
      );
    }
  }
}

function addCustomerSignals(
  target: Record<string, DataQualitySignal>,
  input: CustomerEconomicsDataQualityInput,
) {
  for (const metric of CUSTOMER_DATA_QUALITY_METRICS) {
    const key = dataQualitySignalKey.customer(metric);
    const external = input[CUSTOMER_INPUT_PROPERTIES[metric]];
    if (!external) {
      target[key] = missingSignal(key, "customer_economics");
      continue;
    }
    if (external.state === "ready") {
      target[key] = readySignal(key, "customer_economics");
      continue;
    }
    target[key] = {
      key,
      state: external.state,
      source: "customer_economics",
      reasonCode:
        external.state === "attribution_missing"
          ? "ATTRIBUTION_UNAVAILABLE"
          : external.state === "incomplete"
            ? "CUSTOMER_ECONOMICS_INCOMPLETE"
            : external.state === "conflict"
              ? "CUSTOMER_ECONOMICS_CONFLICT"
              : "INPUT_UNAVAILABLE",
      ...(external.sourceReason ? { sourceReason: external.sourceReason } : {}),
    };
  }
}

export function buildDataQualityProfile(input: DecisionDataQualityInput): DataQualityProfile {
  const signals: Record<string, DataQualitySignal> = {};

  addBusinessSignals(signals, "current", input.currentBusiness);
  addBusinessSignals(signals, "previous", input.previousBusiness);
  addAdSpendReconciliationSignal(signals, input.adSpendReconciliation);
  addFunnelSignals(signals, input.funnels ?? []);
  addCustomerSignals(signals, input.customerEconomics ?? {});

  return {
    signals,
    blockingSignals: Object.values(signals).filter((signal) => signal.state !== "ready"),
  };
}

function dependencySignal(profile: DataQualityProfile, key: string) {
  return profile.signals[key] ?? missingSignal(key, "dependency");
}

function uniqueSignals(signals: readonly DataQualitySignal[]) {
  const byKey = new Map<string, DataQualitySignal>();
  for (const signal of signals) byKey.set(signal.key, signal);
  return [...byKey.values()];
}

export function evaluateDataQualityDependency(
  profile: DataQualityProfile,
  dependency: DataQualityDependency,
): DataQualityDependencyResult {
  const blockers: DataQualitySignal[] = [];

  for (const key of dependency.requiredAll ?? []) {
    const signal = dependencySignal(profile, key);
    if (signal.state !== "ready") blockers.push(signal);
  }

  for (const [groupIndex, group] of (dependency.requiredAny ?? []).entries()) {
    if (group.length === 0) {
      blockers.push(
        invalidDependencySignal(`dependency.${dependency.id}.requiredAny.${groupIndex}`),
      );
      continue;
    }

    const signals = group.map((key) => dependencySignal(profile, key));
    if (!signals.some((signal) => signal.state === "ready")) {
      blockers.push(...signals.filter((signal) => signal.state !== "ready"));
    }
  }

  const uniqueBlockers = uniqueSignals(blockers);
  const ready = uniqueBlockers.length === 0;
  return {
    id: dependency.id,
    ...(dependency.subjectId ? { subjectId: dependency.subjectId } : {}),
    ready,
    blockers: uniqueBlockers,
    messageAr: ready ? null : DATA_QUALITY_INSUFFICIENT_MESSAGE_AR,
  };
}

export function evaluateDataQualityDependencies(
  profile: DataQualityProfile,
  dependencies: readonly DataQualityDependency[],
): DataQualityReadinessSummary {
  const results = dependencies.map((dependency) =>
    evaluateDataQualityDependency(profile, dependency),
  );
  const readyCount = results.filter((result) => result.ready).length;

  return {
    status:
      results.length > 0 && readyCount === results.length
        ? "ready"
        : readyCount > 0
          ? "partial"
          : "insufficient",
    results,
  };
}
