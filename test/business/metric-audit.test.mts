import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCoreFinancials,
  type CalculatedMetric,
  type CoreCalculationInput,
  type ExactRatio,
} from "../../src/lib/business/calculations.ts";
import {
  formatArabicExactDecimal,
  formatArabicExactPercent,
  formatArabicExactRatio,
} from "../../src/lib/business/format-exact.ts";
import {
  createCoreMetricAudits,
  type MetricAuditValue,
} from "../../src/lib/business/metric-audit.ts";

function value<T>(metric: CalculatedMetric<T>) {
  assert.equal(metric.available, true);
  if (!metric.available) throw new Error(`Expected available metric, got ${metric.reason}`);
  return metric.value;
}

function moneyValue(auditValue: MetricAuditValue) {
  assert.equal(auditValue.kind, "money");
  if (auditValue.kind !== "money") throw new Error(`Expected money, got ${auditValue.kind}`);
  return value(auditValue.metric);
}

function ratioValue(auditValue: MetricAuditValue) {
  assert.equal(auditValue.kind, "money_ratio");
  if (auditValue.kind !== "money_ratio") {
    throw new Error(`Expected money ratio, got ${auditValue.kind}`);
  }
  return value(auditValue.metric);
}

const LOCKED_INPUT: CoreCalculationInput = {
  revenueStreams: [],
  unallocatedGrossCashCollected: "50000",
  unallocatedRefunds: "0",
  newCustomers: 30,
  totalPayingCustomers: 30,
  canonicalAdSpend: "12000",
  attributedRevenue: null,
  expenses: [
    {
      id: "acquisition",
      name: "Acquisition",
      category: "acquisition",
      behavior: "fixed_monthly",
      inputValue: "12000",
    },
    {
      id: "fulfillment",
      name: "Fulfillment",
      category: "fulfillment",
      behavior: "fixed_monthly",
      inputValue: "6500",
    },
    {
      id: "overhead",
      name: "Overhead",
      category: "overhead",
      behavior: "fixed_monthly",
      inputValue: "4000",
    },
    {
      id: "financial",
      name: "Financial",
      category: "financial",
      behavior: "fixed_monthly",
      inputValue: "2760",
    },
  ],
};

test("Ultimate CAC audit exposes the locked fully-loaded cost example without recalculating it", () => {
  const result = calculateCoreFinancials(LOCKED_INPUT);
  const audits = createCoreMetricAudits(result, LOCKED_INPUT);
  const ultimate = audits.ultimateCac;

  assert.equal(value(result.expensesByCategory.acquisition), "12000");
  assert.equal(value(result.expensesByCategory.fulfillment), "6500");
  assert.equal(value(result.expensesByCategory.overhead), "4000");
  assert.equal(value(result.expensesByCategory.financial), "2760");
  assert.equal(value(result.allBusinessCosts), "25260");
  assert.equal(value(result.newCustomers), 30);
  assert.deepEqual(value(result.ultimateCac), { numerator: "842", denominator: "1" });

  assert.equal(ultimate.formula, "إجمالي تكاليف البزنس ÷ العملاء الجدد");
  assert.match(ultimate.note ?? "", /التكلفة الكاملة للبزنس لكل عميل جديد/);
  assert.match(ultimate.note ?? "", /ليس CAC التقليدي/);

  const lineValues = new Map(ultimate.lines.map((line) => [line.id, line.value]));
  assert.equal(moneyValue(lineValues.get("ultimate-acquisition")!), "12000");
  assert.equal(moneyValue(lineValues.get("ultimate-fulfillment")!), "6500");
  assert.equal(moneyValue(lineValues.get("ultimate-overhead")!), "4000");
  assert.equal(moneyValue(lineValues.get("ultimate-financial")!), "2760");
  assert.equal(moneyValue(lineValues.get("ultimate-all-costs")!), "25260");

  const customerLine = lineValues.get("ultimate-new-customers")!;
  assert.equal(customerLine.kind, "count");
  if (customerLine.kind !== "count") throw new Error("Expected count line");
  assert.equal(value(customerLine.metric), 30);

  assert.equal(ultimate.result.metric, result.ultimateCac);
  assert.deepEqual(ratioValue(ultimate.result), { numerator: "842", denominator: "1" });
});

test("audit trails preserve unavailable denominator reasons and canonical ad-spend provenance", () => {
  const noCustomersInput: CoreCalculationInput = {
    ...LOCKED_INPUT,
    newCustomers: 0,
    totalPayingCustomers: 0,
  };
  const result = calculateCoreFinancials(noCustomersInput);
  const audits = createCoreMetricAudits(result, noCustomersInput);

  assert.deepEqual(result.mediaCac, { available: false, reason: "NO_NEW_CUSTOMERS" });
  assert.equal(audits.mediaCac.result.metric, result.mediaCac);
  assert.equal(moneyValue(audits.mediaCac.lines[0].value), "12000");
  assert.deepEqual(audits.mediaCac.result.metric, {
    available: false,
    reason: "NO_NEW_CUSTOMERS",
  });
});

test("period customer-value audits remain explicitly distinct from LTV", () => {
  const result = calculateCoreFinancials(LOCKED_INPUT);
  const audits = createCoreMetricAudits(result, LOCKED_INPUT);

  assert.match(audits.revenuePerPayingCustomer.note ?? "", /ليس LTV/);
  assert.match(audits.revenuePerNewCustomer.note ?? "", /ليس LTV/);

  const expected: ExactRatio = { numerator: "5000", denominator: "3" };
  assert.deepEqual(value(result.revenuePerNewCustomer), expected);
  assert.equal(audits.revenuePerNewCustomer.result.metric, result.revenuePerNewCustomer);
});

test("audit display helpers preserve exact values beyond JavaScript safe integers", () => {
  assert.equal(formatArabicExactDecimal("9007199254740993", 2), "٩٬٠٠٧٬١٩٩٬٢٥٤٬٧٤٠٬٩٩٣");
  assert.equal(
    formatArabicExactRatio({ numerator: "9007199254740993", denominator: "3" }, 2),
    "٣٬٠٠٢٬٣٩٩٬٧٥١٬٥٨٠٬٣٣١",
  );
  assert.equal(
    formatArabicExactPercent({ numerator: "9007199254740993", denominator: "10000000000000000" }, 1),
    "٩٠٫١",
  );
});
