import assert from "node:assert/strict";
import test from "node:test";
import { calculateCoreFinancials } from "../../src/lib/business/calculations.ts";
import { buildTargetPlannerActualMonth } from "../../src/lib/business/target-planner-actuals.ts";

function coreResult() {
  return calculateCoreFinancials({
    revenueStreams: [
      {
        id: "front-end",
        name: "Front End",
        streamType: "front_end",
        grossCashCollected: "10000",
        refunds: "0",
      },
    ],
    expenses: [
      {
        id: "media",
        name: "Media",
        category: "acquisition",
        behavior: "fixed_monthly",
        inputValue: "2000",
      },
      {
        id: "sales-tools",
        name: "Sales tools",
        category: "acquisition",
        behavior: "fixed_monthly",
        inputValue: "500",
      },
      {
        id: "commission",
        name: "Commission",
        category: "acquisition",
        behavior: "per_customer",
        inputValue: "20",
        customerCountBasis: "new_customers",
      },
      {
        id: "delivery",
        name: "Delivery",
        category: "fulfillment",
        behavior: "per_customer",
        inputValue: "30",
        customerCountBasis: "new_customers",
      },
      {
        id: "software",
        name: "Software",
        category: "overhead",
        behavior: "fixed_monthly",
        inputValue: "1000",
      },
      {
        id: "processor",
        name: "Processor",
        category: "financial",
        behavior: "percentage_revenue",
        inputValue: "0.02",
      },
    ],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers: 10,
    totalPayingCustomers: 10,
    canonicalAdSpend: "2000",
  });
}

const funnelEntry = {
  funnel_id: "funnel-1",
  funnel_name_snapshot: "Main Funnel",
  funnel_type_snapshot: "appointment",
  ad_spend: "2000",
  leads: 100,
  booked_calls: 20,
  showed_calls: 16,
  qualified_calls: 12,
  sales: 10,
  new_customers: 10,
  cash_collected: "10000",
  attributed_revenue: null,
};

test("builds one exact planner month without double-counting media spend", () => {
  const result = buildTargetPlannerActualMonth({
    month: "2026-07",
    core: coreResult(),
    canonicalAdSpend: "2000",
    funnelEntries: [funnelEntry],
  });

  assert.deepEqual(result, {
    status: "ready",
    actual: {
      month: "2026-07",
      netCashCollected: "10000",
      newCustomers: 10,
      adSpend: "2000",
      fixedAcquisitionCosts: "500",
      fixedNonAcquisitionCosts: "1000",
      variableNonMediaAcquisitionCosts: "200",
      variableNonAcquisitionCosts: "500",
      leads: 100,
      bookedCalls: 20,
      showedCalls: 16,
      qualifiedCalls: 12,
      sales: 10,
    },
  });
});

test("fails closed when canonical media spend cannot be separated from fixed acquisition costs", () => {
  const result = buildTargetPlannerActualMonth({
    month: "2026-07",
    core: coreResult(),
    canonicalAdSpend: "3000",
    funnelEntries: [funnelEntry],
  });

  assert.deepEqual(result, {
    status: "insufficient",
    blocker: "MEDIA_EXCEEDS_FIXED_ACQUISITION",
  });
});

test("fails closed when matching media spend is modeled as a variable acquisition cost", () => {
  const variableMediaCore = calculateCoreFinancials({
    revenueStreams: [
      {
        id: "front-end",
        name: "Front End",
        streamType: "front_end",
        grossCashCollected: "10000",
        refunds: "0",
      },
    ],
    expenses: [
      {
        id: "media-variable",
        name: "Variable media",
        category: "acquisition",
        behavior: "per_customer",
        inputValue: "200",
        customerCountBasis: "new_customers",
      },
      {
        id: "sales-tools",
        name: "Sales tools",
        category: "acquisition",
        behavior: "fixed_monthly",
        inputValue: "500",
      },
    ],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers: 10,
    totalPayingCustomers: 10,
    canonicalAdSpend: "2000",
  });

  const result = buildTargetPlannerActualMonth({
    month: "2026-07",
    core: variableMediaCore,
    canonicalAdSpend: "2000",
    funnelEntries: [funnelEntry],
  });

  assert.deepEqual(result, {
    status: "insufficient",
    blocker: "MEDIA_EXCEEDS_FIXED_ACQUISITION",
  });
});

test("fails closed when funnel new customers do not reconcile to the business month", () => {
  const result = buildTargetPlannerActualMonth({
    month: "2026-07",
    core: coreResult(),
    canonicalAdSpend: "2000",
    funnelEntries: [{ ...funnelEntry, new_customers: 9 }],
  });

  assert.deepEqual(result, {
    status: "insufficient",
    blocker: "FUNNEL_CUSTOMER_MISMATCH",
  });
});
