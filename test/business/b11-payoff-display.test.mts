import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateCoreFinancials } from "../../src/lib/business/calculations.ts";
import { buildSetupPayoffCards } from "../../src/lib/business/setup-payoff-display.ts";

function knownNumbers(options: {
  gross?: string;
  refunds?: string;
  newCustomers?: number;
  cost?: string;
} = {}) {
  const gross = options.gross ?? "12000";
  const refunds = options.refunds ?? "2000";
  const customers = options.newCustomers ?? 11;
  return calculateCoreFinancials({
    revenueStreams: [{ id: "agency", name: "Agency", streamType: "front_end", grossCashCollected: gross, refunds }],
    expenses: [
      { id: "ads", name: "Ads", category: "acquisition", behavior: "fixed_monthly", inputValue: options.cost ?? "2500" },
      { id: "delivery", name: "Delivery", category: "fulfillment", behavior: "fixed_monthly", inputValue: "1000" },
      { id: "rent", name: "Rent", category: "overhead", behavior: "fixed_monthly", inputValue: "1500" },
      { id: "fees", name: "Fees", category: "financial", behavior: "fixed_monthly", inputValue: "500" },
    ],
    unallocatedGrossCashCollected: "0",
    unallocatedRefunds: "0",
    newCustomers: customers,
    totalPayingCustomers: customers,
    canonicalAdSpend: null,
  });
}

test("B11.3 displays only the four locked metrics, in order, using canonical Arabic precision", () => {
  const financials = knownNumbers();
  const cards = buildSetupPayoffCards(financials, "USD");
  assert.equal(cards.length, 4);
  assert.deepEqual(cards.map((card) => card.key), [
    "netCashCollected", "realNetProfit", "realNetProfitMargin", "ultimateCac",
  ]);
  assert.deepEqual(cards.map((card) => card.label), [
    "صافي التحصيل",
    "صافي الربح الحقيقي",
    "هامش صافي الربح الحقيقي",
    "التكلفة الكاملة للبزنس لكل عميل جديد",
  ]);
  assert.deepEqual(cards.map((card) => card.value), [
    "١٠٬٠٠٠ USD", "٤٬٥٠٠ USD", "٤٥٪", "٥٠٠ USD",
  ]);
  assert.ok(cards.every((card) => !card.unavailable && card.explanation === null));
  assert.match(cards[3].description ?? "", /مؤشر خاص بميزان/);
  assert.match(cards[3].description ?? "", /ليس تكلفة|وليس تكلفة/);
});

test("B11.3 keeps actual losses negative without warning-colored positive values", () => {
  const cards = buildSetupPayoffCards(knownNumbers({ gross: "2000", refunds: "0" }), "EGP");
  assert.deepEqual(cards.map((card) => card.value), [
    "٢٬٠٠٠ EGP", "-٣٬٥٠٠ EGP", "-١٧٥٪", "٥٠٠ EGP",
  ]);
  assert.equal(cards[0].negative, false);
  assert.equal(cards[1].negative, true);
  assert.equal(cards[2].negative, true);
});

test("B11.3 confirmed zero new customers leaves only Ultimate CAC unavailable", () => {
  const cards = buildSetupPayoffCards(knownNumbers({ newCustomers: 0 }), "USD");
  assert.equal(cards[3].value, "—");
  assert.equal(cards[3].unavailable, true);
  assert.equal(
    cards[3].explanation,
    "لا يمكن حساب التكلفة لكل عميل جديد لأن عدد العملاء الجدد صفر.",
  );
  assert.deepEqual(cards.slice(0, 3).map((card) => card.value), [
    "١٠٬٠٠٠ USD", "٤٬٥٠٠ USD", "٤٥٪",
  ]);
});

test("B11.3 zero net cash shows an unavailable margin but preserves actual negative profit", () => {
  const cards = buildSetupPayoffCards(knownNumbers({ gross: "0", refunds: "0" }), "USD");
  assert.deepEqual(cards.map((card) => card.value), [
    "٠ USD", "-٥٬٥٠٠ USD", "—", "٥٠٠ USD",
  ]);
  assert.equal(cards[1].negative, true);
  assert.equal(cards[2].unavailable, true);
  assert.equal(cards[2].explanation, "لا يمكن حساب هامش الربح لأن صافي التحصيل صفر.");
});

test("B11.3 unavailable calculations never become 0, NaN or fabricated profitability", () => {
  const original = knownNumbers();
  const missing = {
    ...original,
    realNetProfitMargin: { available: false as const, reason: "INPUT_UNAVAILABLE" as const },
  };
  const cards = buildSetupPayoffCards(missing, "SAR");
  assert.equal(cards[2].value, "—");
  assert.equal(cards[2].explanation, "البيانات اللازمة لحساب هذا المؤشر غير متاحة بعد.");
  assert.equal(cards[2].unavailable, true);
  assert.ok(!cards.some((card) => /NaN|Infinity/.test(card.value)));
});

test("B11.3 route keeps GET-only exact-month eligibility and renders four-metric component", () => {
  const page = readFileSync("src/app/(app)/businesses/[businessId]/setup/result/page.tsx", "utf8");
  const screen = readFileSync("src/app/(app)/businesses/[businessId]/setup/result/payoff-screen.tsx", "utf8");
  assert.match(page, /loadAuthenticatedSetupPayoff\(businessId, query\.month\)/);
  assert.match(page, /<PayoffScreen/);
  assert.match(screen, /buildSetupPayoffCards\(financials, currency\)/);
  assert.match(screen, /aria-labelledby/);
  assert.match(screen, /افتح لوحة البزنس/);
  assert.match(screen, /مراجعة أرقام الشهر/);
  assert.doesNotMatch(page + screen, /\.rpc\(|\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
});
