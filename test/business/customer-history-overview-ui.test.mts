import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parseCustomerHistoryOverviewSummary } from "../../src/lib/business/customer-history-overview.ts";

test("customer history overview parser preserves exact count and money text", () => {
  assert.deepEqual(
    parseCustomerHistoryOverviewSummary({
      paying_customer_count_text: "9007199254740993",
      repeat_customer_count_text: "7",
      net_cash_collected_text: "12345678901234567890.12345678",
      revenue_per_paying_customer_text: "1370.6457093212703",
    }),
    {
      payingCustomerCountText: "9007199254740993",
      repeatCustomerCountText: "7",
      netCashCollectedText: "12345678901234567890.12345678",
      revenuePerPayingCustomerText: "1370.6457093212703",
    },
  );
});

test("customer history overview parser preserves zero denominator semantics", () => {
  assert.deepEqual(
    parseCustomerHistoryOverviewSummary({
      paying_customer_count_text: "0",
      repeat_customer_count_text: "0",
      net_cash_collected_text: "-10",
      revenue_per_paying_customer_text: null,
    }),
    {
      payingCustomerCountText: "0",
      repeatCustomerCountText: "0",
      netCashCollectedText: "-10",
      revenuePerPayingCustomerText: null,
    },
  );

  assert.equal(
    parseCustomerHistoryOverviewSummary({
      paying_customer_count_text: "0",
      repeat_customer_count_text: "0",
      net_cash_collected_text: "0",
      revenue_per_paying_customer_text: "0",
    }),
    null,
  );
});

test("customer history overview parser fails closed on impossible or lossy payloads", () => {
  assert.equal(
    parseCustomerHistoryOverviewSummary({
      paying_customer_count_text: "2",
      repeat_customer_count_text: "3",
      net_cash_collected_text: "190",
      revenue_per_paying_customer_text: "95",
    }),
    null,
  );
  assert.equal(
    parseCustomerHistoryOverviewSummary({
      paying_customer_count_text: 2,
      repeat_customer_count_text: "1",
      net_cash_collected_text: "190",
      revenue_per_paying_customer_text: "95",
    }),
    null,
  );
});

test("customer history overview stays distinct from Observed LTV in the user-facing workspace", () => {
  const page = fs.readFileSync("src/app/(app)/businesses/[businessId]/customers/page.tsx", "utf8");
  const panel = fs.readFileSync(
    "src/app/(app)/businesses/[businessId]/customers/customer-history-overview.tsx",
    "utf8",
  );
  const migration = fs.readFileSync(
    "supabase/migrations/20260907120000_customer_history_overview.sql",
    "utf8",
  );

  assert.match(page, /customer_history_overview/);
  assert.match(page, /parseCustomerHistoryOverviewSummary/);
  assert.match(panel, /صافي التحصيل لكل عميل دافع/);
  assert.match(panel, /هذا ليس LTV/);
  assert.match(panel, /Observed LTV \/ قيمة العميل المحققة حتى الآن/);
  assert.match(migration, /security_invoker = true/);
  assert.match(migration, /customer\.collection_count > 1/);
  assert.match(migration, /customer\.acquisition_at is not null/);
});
