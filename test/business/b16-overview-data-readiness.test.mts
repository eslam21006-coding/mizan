import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOverviewReadinessModel,
  resolveOverviewReadinessAction,
} from "../../src/lib/business/overview-readiness.ts";
import {
  resolveCoreSetupReadiness,
  resolveCustomerReadiness,
  resolveHistoryReadiness,
  resolveSalesReadiness,
} from "../../src/lib/business/readiness.ts";

function readyCore() {
  return resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup: "reviewed",
    validMonthCount: 3,
  });
}

function baseInput() {
  return {
    businessId: "00000000-0000-4000-8000-000000000016",
    monthKey: "2026-10",
    core: readyCore(),
    history: resolveHistoryReadiness({ loadState: "loaded", validMonthCount: 3 }),
    customers: resolveCustomerReadiness({
      loadState: "loaded",
      transactionCount: 10,
      reviewIssueCount: 0,
      analysisReady: true,
    }),
    sales: resolveSalesReadiness({
      loadState: "loaded",
      funnelCount: 1,
      monthlyDataReady: true,
    }),
  };
}

test("B16 maps exactly four compact readiness domains in canonical order", () => {
  const model = buildOverviewReadinessModel(baseInput());

  assert.deepEqual(
    model.rows.map((row) => [row.key, row.label, row.value]),
    [
      ["core", "الأساسيات", "مكتملة"],
      ["history", "التاريخ", "3 أشهر أو أكثر"],
      ["customers", "العملاء", "جاهزة"],
      ["sales", "المبيعات", "البيانات جاهزة"],
    ],
  );
  assert.equal(model.action, null);
});

test("B16 prioritizes incomplete Core before optional Customers or Sales", () => {
  const input = baseInput();
  input.core = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 0,
    expenseSetup: "not_reviewed",
    validMonthCount: 0,
  });
  input.customers = resolveCustomerReadiness({
    loadState: "loaded",
    transactionCount: 0,
    reviewIssueCount: 0,
    analysisReady: false,
  });
  input.sales = resolveSalesReadiness({
    loadState: "loaded",
    funnelCount: 0,
    monthlyDataReady: false,
  });

  assert.deepEqual(resolveOverviewReadinessAction(input), {
    domain: "core",
    label: "أضف مصادر الإيراد",
    href: "/businesses/00000000-0000-4000-8000-000000000016/setup?step=revenue",
  });
});

test("B16 routes first valid month to the existing monthly-entry workflow", () => {
  const input = baseInput();
  input.core = resolveCoreSetupReadiness({
    loadState: "loaded",
    businessIdentityReady: true,
    revenueSourceCount: 1,
    expenseSetup: "reviewed",
    validMonthCount: 0,
  });

  assert.deepEqual(resolveOverviewReadinessAction(input), {
    domain: "core",
    label: "أدخل أول شهر",
    href: "/businesses/00000000-0000-4000-8000-000000000016/monthly?month=2026-10",
  });
});

test("B16 progresses from customer import to review before optional Sales", () => {
  const noTransactions = baseInput();
  noTransactions.customers = resolveCustomerReadiness({
    loadState: "loaded",
    transactionCount: 0,
    reviewIssueCount: 0,
    analysisReady: false,
  });
  noTransactions.sales = resolveSalesReadiness({
    loadState: "loaded",
    funnelCount: 0,
    monthlyDataReady: false,
  });

  assert.deepEqual(resolveOverviewReadinessAction(noTransactions), {
    domain: "customers",
    label: "أضف بيانات العملاء",
    href: "/businesses/00000000-0000-4000-8000-000000000016/customers/import",
  });

  const needsReview = baseInput();
  needsReview.customers = resolveCustomerReadiness({
    loadState: "loaded",
    transactionCount: 5,
    reviewIssueCount: 2,
    analysisReady: false,
  });

  assert.deepEqual(resolveOverviewReadinessAction(needsReview), {
    domain: "customers",
    label: "راجع بيانات العملاء",
    href: "/businesses/00000000-0000-4000-8000-000000000016/customers/review",
  });
});

test("B16 keeps Sales optional while offering it only after higher-priority data is ready", () => {
  const noFunnel = baseInput();
  noFunnel.sales = resolveSalesReadiness({
    loadState: "loaded",
    funnelCount: 0,
    monthlyDataReady: false,
  });

  const model = buildOverviewReadinessModel(noFunnel);
  assert.equal(model.rows.find((row) => row.key === "core")?.value, "مكتملة");
  assert.equal(model.rows.find((row) => row.key === "sales")?.value, "لم تتم إضافة طريقة بيع");
  assert.deepEqual(model.action, {
    domain: "sales",
    label: "أضف طريقة البيع",
    href: "/businesses/00000000-0000-4000-8000-000000000016/funnels",
  });

  const configured = baseInput();
  configured.sales = resolveSalesReadiness({
    loadState: "loaded",
    funnelCount: 1,
    monthlyDataReady: false,
  });
  assert.deepEqual(resolveOverviewReadinessAction(configured), {
    domain: "sales",
    label: "أدخل أرقام المبيعات",
    href: "/businesses/00000000-0000-4000-8000-000000000016/funnels/monthly?month=2026-10",
  });
});

test("B16 load errors fail closed and never masquerade as known zero data", () => {
  const input = baseInput();
  input.customers = resolveCustomerReadiness({
    loadState: "load_error",
    transactionCount: null,
    reviewIssueCount: null,
    analysisReady: null,
  });
  input.sales = resolveSalesReadiness({
    loadState: "loaded",
    funnelCount: 0,
    monthlyDataReady: false,
  });

  const model = buildOverviewReadinessModel(input);
  assert.equal(model.rows.find((row) => row.key === "customers")?.value, "تعذر التحقق");
  assert.equal(model.rows.find((row) => row.key === "sales")?.value, "لم تتم إضافة طريقة بيع");
  assert.equal(model.action, null);
});

test("B16 readiness presentation is deterministic and does not mutate canonical input", () => {
  const input = baseInput();
  const before = structuredClone(input);

  assert.deepEqual(buildOverviewReadinessModel(input), buildOverviewReadinessModel(input));
  assert.deepEqual(input, before);
});
