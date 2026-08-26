import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCoreFinancials,
  type CoreCalculationInput,
} from "../../src/lib/business/calculations.ts";
import {
  calculateFunnelMetrics,
  reconcileBusinessAdSpend,
} from "../../src/lib/business/funnel-calculations.ts";
import {
  buildDataQualityProfile,
  DATA_QUALITY_INSUFFICIENT_MESSAGE_AR,
  dataQualitySignalKey,
  evaluateDataQualityDependencies,
  evaluateDataQualityDependency,
} from "../../src/lib/business/data-quality.ts";

function coreInput(overrides: Partial<CoreCalculationInput> = {}): CoreCalculationInput {
  return {
    revenueStreams: [
      {
        id: "core-offer",
        name: "Core Offer",
        streamType: "front_end",
        grossCashCollected: "100000",
        refunds: "5000",
      },
    ],
    expenses: [
      {
        id: "ads",
        name: "Ads",
        category: "acquisition",
        behavior: "fixed_monthly",
        inputValue: "20000",
      },
    ],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers: 50,
    totalPayingCustomers: 80,
    canonicalAdSpend: "20000",
    attributedRevenue: "60000",
    ...overrides,
  };
}

function completeFunnel() {
  return calculateFunnelMetrics({
    adSpend: "20000",
    leads: 200,
    bookedCalls: 80,
    showedCalls: 60,
    qualifiedCalls: 40,
    sales: 12,
    newCustomers: 10,
    cashCollected: "30000",
    attributedRevenue: "28000",
  });
}

function completeCustomerEconomics() {
  return {
    observedLtv: { state: "ready" as const },
    backendLifetimeRevenue: { state: "ready" as const },
    lifetimeRevenueAttribution: { state: "ready" as const },
    lifetimeContributionProfit: { state: "ready" as const },
  };
}

test("Task 26 marks complete business, funnel, reconciliation, and customer data as ready", () => {
  const profile = buildDataQualityProfile({
    currentBusiness: calculateCoreFinancials(coreInput()),
    previousBusiness: calculateCoreFinancials(coreInput({ canonicalAdSpend: "19000" })),
    adSpendReconciliation: reconcileBusinessAdSpend("20000", ["20000"]),
    funnels: [{ id: "calls", name: "Calls", metrics: completeFunnel() }],
    customerEconomics: completeCustomerEconomics(),
  });

  assert.equal(profile.signals[dataQualitySignalKey.business("current", "ultimate_cac")]?.state, "ready");
  assert.equal(profile.signals[dataQualitySignalKey.business("previous", "media_cac")]?.state, "ready");
  assert.equal(profile.signals[dataQualitySignalKey.funnel("calls", "show_rate")]?.state, "ready");
  assert.equal(profile.signals[dataQualitySignalKey.customer("observed_ltv")]?.state, "ready");
  assert.equal(profile.signals[dataQualitySignalKey.adSpendReconciliation]?.state, "ready");

  const summary = evaluateDataQualityDependencies(profile, [
    {
      id: "revenue-profit-trend",
      requiredAll: [
        dataQualitySignalKey.business("current", "net_cash_collected"),
        dataQualitySignalKey.business("current", "real_net_profit"),
        dataQualitySignalKey.business("previous", "net_cash_collected"),
        dataQualitySignalKey.business("previous", "real_net_profit"),
      ],
    },
    {
      id: "funnel-attendance-vs-close",
      subjectId: "calls",
      requiredAll: [
        dataQualitySignalKey.funnel("calls", "show_rate"),
        dataQualitySignalKey.funnel("calls", "close_rate"),
      ],
    },
    {
      id: "cac-with-customer-value",
      requiredAll: [dataQualitySignalKey.business("current", "ultimate_cac")],
      requiredAny: [[
        dataQualitySignalKey.customer("backend_lifetime_revenue"),
        dataQualitySignalKey.customer("observed_ltv"),
        dataQualitySignalKey.customer("lifetime_contribution_profit"),
      ]],
    },
  ]);

  assert.equal(summary.status, "ready");
  assert.ok(summary.results.every((result) => result.ready));
});

test("Task 26 keeps missing attribution and missing history explicit instead of manufacturing readiness", () => {
  const profile = buildDataQualityProfile({
    currentBusiness: calculateCoreFinancials(coreInput({ attributedRevenue: null })),
    previousBusiness: null,
    adSpendReconciliation: null,
    funnels: [
      {
        id: "calls",
        metrics: calculateFunnelMetrics({
          adSpend: "20000",
          leads: 200,
          bookedCalls: 80,
          showedCalls: 60,
          qualifiedCalls: 40,
          sales: 12,
          newCustomers: 10,
          cashCollected: "30000",
          attributedRevenue: null,
        }),
      },
    ],
    customerEconomics: {
      lifetimeRevenueAttribution: {
        state: "attribution_missing",
        sourceReason: "Unattributed lifetime cash remains.",
      },
    },
  });

  const businessRoas = profile.signals[dataQualitySignalKey.business("current", "roas")];
  const funnelRoas = profile.signals[dataQualitySignalKey.funnel("calls", "roas")];
  const previousProfit = profile.signals[dataQualitySignalKey.business("previous", "real_net_profit")];
  const lifetimeAttribution = profile.signals[dataQualitySignalKey.customer("lifetime_revenue_attribution")];

  assert.equal(businessRoas?.state, "attribution_missing");
  assert.equal(businessRoas?.reasonCode, "ATTRIBUTION_UNAVAILABLE");
  assert.equal(funnelRoas?.state, "attribution_missing");
  assert.equal(previousProfit?.state, "missing");
  assert.equal(previousProfit?.reasonCode, "SIGNAL_NOT_PROVIDED");
  assert.equal(lifetimeAttribution?.state, "attribution_missing");
  assert.equal(profile.signals[dataQualitySignalKey.customer("observed_ltv")]?.state, "missing");

  const result = evaluateDataQualityDependency(profile, {
    id: "roas-trend",
    requiredAll: [
      dataQualitySignalKey.business("current", "roas"),
      dataQualitySignalKey.business("previous", "roas"),
    ],
  });

  assert.equal(result.ready, false);
  assert.equal(result.messageAr, DATA_QUALITY_INSUFFICIENT_MESSAGE_AR);
  assert.ok(result.blockers.some((blocker) => blocker.state === "attribution_missing"));
  assert.ok(result.blockers.some((blocker) => blocker.state === "missing"));
});

test("Task 26 preserves known zero denominators as different from missing inputs", () => {
  const profile = buildDataQualityProfile({
    currentBusiness: calculateCoreFinancials(
      coreInput({
        newCustomers: 0,
        totalPayingCustomers: 0,
      }),
    ),
    previousBusiness: calculateCoreFinancials(coreInput()),
    adSpendReconciliation: reconcileBusinessAdSpend("20000", ["20000"]),
    funnels: [
      {
        id: "zero-calls",
        metrics: calculateFunnelMetrics({
          adSpend: "1000",
          leads: 10,
          bookedCalls: 0,
          showedCalls: 0,
          qualifiedCalls: 0,
          sales: 0,
          newCustomers: 0,
          cashCollected: "0",
          attributedRevenue: "0",
        }),
      },
    ],
  });

  const ultimateCac = profile.signals[dataQualitySignalKey.business("current", "ultimate_cac")];
  const showRate = profile.signals[dataQualitySignalKey.funnel("zero-calls", "show_rate")];
  const observedLtv = profile.signals[dataQualitySignalKey.customer("observed_ltv")];

  assert.equal(ultimateCac?.state, "known_zero");
  assert.equal(ultimateCac?.sourceReason, "NO_NEW_CUSTOMERS");
  assert.equal(showRate?.state, "known_zero");
  assert.equal(showRate?.sourceReason, "NO_BOOKED_CALLS");
  assert.equal(observedLtv?.state, "missing");
  assert.notEqual(showRate?.state, observedLtv?.state);

  const result = evaluateDataQualityDependency(profile, {
    id: "funnel-attendance-vs-close",
    subjectId: "zero-calls",
    requiredAll: [
      dataQualitySignalKey.funnel("zero-calls", "show_rate"),
      dataQualitySignalKey.funnel("zero-calls", "close_rate"),
    ],
  });

  assert.equal(result.ready, false);
  assert.equal(result.messageAr, "البيانات غير كافية للحكم");
  assert.ok(result.blockers.every((blocker) => blocker.state === "known_zero"));
});

test("Task 26 blocks ad-dependent conclusions when business and funnel ad spend conflict", () => {
  const profile = buildDataQualityProfile({
    currentBusiness: calculateCoreFinancials(coreInput()),
    previousBusiness: calculateCoreFinancials(coreInput()),
    adSpendReconciliation: reconcileBusinessAdSpend("20000", ["18000"]),
  });

  assert.equal(profile.signals[dataQualitySignalKey.business("current", "media_cac")]?.state, "ready");

  const reconciliation = profile.signals[dataQualitySignalKey.adSpendReconciliation];
  assert.equal(reconciliation?.state, "conflict");
  assert.equal(reconciliation?.reasonCode, "AD_SPEND_RECONCILIATION_MISMATCH");

  const result = evaluateDataQualityDependency(profile, {
    id: "media-vs-ultimate-cac-trend",
    requiredAll: [
      dataQualitySignalKey.business("current", "media_cac"),
      dataQualitySignalKey.business("previous", "media_cac"),
      dataQualitySignalKey.business("current", "ultimate_cac"),
      dataQualitySignalKey.business("previous", "ultimate_cac"),
      dataQualitySignalKey.adSpendReconciliation,
    ],
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers.map((blocker) => blocker.reasonCode), [
    "AD_SPEND_RECONCILIATION_MISMATCH",
  ]);
});

test("Task 26 distinguishes a known non-positive Net Cash boundary from missing data", () => {
  const profile = buildDataQualityProfile({
    currentBusiness: calculateCoreFinancials(
      coreInput({
        revenueStreams: [
          {
            id: "refund-heavy",
            name: "Refund Heavy",
            streamType: "front_end",
            grossCashCollected: "0",
            refunds: "100",
          },
        ],
        expenses: [],
        newCustomers: 1,
        totalPayingCustomers: 1,
        canonicalAdSpend: "10",
      }),
    ),
  });

  const margin = profile.signals[dataQualitySignalKey.business("current", "real_net_profit_margin")];
  assert.equal(margin?.state, "known_value_blocker");
  assert.equal(margin?.sourceReason, "NON_POSITIVE_NET_CASH");
  assert.equal(margin?.reasonCode, "KNOWN_VALUE_CANNOT_SUPPORT_METRIC");
});

test("Task 26 reports partial readiness when only some deterministic dependencies are supportable", () => {
  const profile = buildDataQualityProfile({
    currentBusiness: calculateCoreFinancials(coreInput()),
    previousBusiness: calculateCoreFinancials(coreInput()),
    adSpendReconciliation: reconcileBusinessAdSpend("20000", ["20000"]),
    customerEconomics: {
      observedLtv: { state: "incomplete", sourceReason: "No mature transaction cohort yet." },
      backendLifetimeRevenue: { state: "missing" },
      lifetimeContributionProfit: { state: "incomplete" },
    },
  });

  const summary = evaluateDataQualityDependencies(profile, [
    {
      id: "revenue-profit-trend",
      requiredAll: [
        dataQualitySignalKey.business("current", "net_cash_collected"),
        dataQualitySignalKey.business("previous", "net_cash_collected"),
        dataQualitySignalKey.business("current", "real_net_profit"),
        dataQualitySignalKey.business("previous", "real_net_profit"),
      ],
    },
    {
      id: "customer-value",
      requiredAny: [[
        dataQualitySignalKey.customer("observed_ltv"),
        dataQualitySignalKey.customer("backend_lifetime_revenue"),
        dataQualitySignalKey.customer("lifetime_contribution_profit"),
      ]],
    },
  ]);

  assert.equal(summary.status, "partial");
  assert.equal(summary.results[0]?.ready, true);
  assert.equal(summary.results[1]?.ready, false);
  assert.equal(summary.results[1]?.messageAr, DATA_QUALITY_INSUFFICIENT_MESSAGE_AR);
});

test("Task 26 fails closed when a requiredAny group declares no alternatives", () => {
  const profile = buildDataQualityProfile({
    currentBusiness: calculateCoreFinancials(coreInput()),
    previousBusiness: calculateCoreFinancials(coreInput()),
  });

  const result = evaluateDataQualityDependency(profile, {
    id: "invalid-any-of",
    requiredAny: [[]],
  });

  assert.equal(result.ready, false);
  assert.equal(result.messageAr, DATA_QUALITY_INSUFFICIENT_MESSAGE_AR);
  assert.equal(result.blockers.length, 1);
  assert.equal(result.blockers[0]?.state, "incomplete");
  assert.equal(result.blockers[0]?.source, "dependency");
  assert.equal(result.blockers[0]?.reasonCode, "INVALID_DEPENDENCY");
});
