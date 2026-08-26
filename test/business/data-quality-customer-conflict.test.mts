import assert from "node:assert/strict";
import test from "node:test";

import { calculateCoreFinancials } from "../../src/lib/business/calculations.ts";
import {
  buildDataQualityProfile,
  dataQualitySignalKey,
} from "../../src/lib/business/data-quality.ts";

test("Task 26 preserves customer economics conflicts as conflicts in both state and reason", () => {
  const currentBusiness = calculateCoreFinancials({
    revenueStreams: [
      {
        id: "core-offer",
        name: "Core Offer",
        streamType: "front_end",
        grossCashCollected: "1000",
        refunds: "0",
      },
    ],
    expenses: [],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers: 1,
    totalPayingCustomers: 1,
    canonicalAdSpend: "0",
    attributedRevenue: null,
  });

  const profile = buildDataQualityProfile({
    currentBusiness,
    customerEconomics: {
      observedLtv: {
        state: "conflict",
        sourceReason: "Conflicting cohort source rows.",
      },
    },
  });

  const signal = profile.signals[dataQualitySignalKey.customer("observed_ltv")];
  assert.equal(signal?.state, "conflict");
  assert.equal(signal?.reasonCode, "CUSTOMER_ECONOMICS_CONFLICT");
  assert.equal(signal?.sourceReason, "Conflicting cohort source rows.");
});
