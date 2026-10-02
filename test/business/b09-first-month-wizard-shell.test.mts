import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveFirstMonthSelection } from "../../src/lib/business/first-month-selection.ts";
import {
  buildMonthlyEntryRows,
  monthlyInputValue,
} from "../../src/lib/business/monthly-entry-rows.ts";

test("B09 month selection respects the business timezone and strictly rejects invalid or duplicate months", () => {
  const nearBoundary = new Date("2026-09-30T22:30:00.000Z");
  assert.deepEqual(resolveFirstMonthSelection(undefined, "Africa/Cairo", nearBoundary), {
    kind: "default",
    monthKey: "2026-10",
  });
  assert.deepEqual(resolveFirstMonthSelection("2026-09", "Africa/Cairo", nearBoundary), {
    kind: "valid",
    monthKey: "2026-09",
  });
  for (const invalid of ["2026-13", "2026-00", "2026-09-01", "bad", ["2026-09", "2026-10"]]) {
    assert.deepEqual(resolveFirstMonthSelection(invalid, "Africa/Cairo", nearBoundary), {
      kind: "invalid",
      monthKey: "2026-10",
    });
  }
});

test("B09 shares active and archived Monthly row mapping with the production editor", () => {
  const result = buildMonthlyEntryRows({
    streams: [
      { id: "active", name: "الكورس الأساسي", stream_type: "other", is_active: true },
      { id: "archived", name: "VIP الحالي", stream_type: "other", is_active: false },
      { id: "unused", name: "عرض غير نشط", stream_type: "other", is_active: false },
    ],
    expenses: [
      { id: "fixed", name: "Meta Ads", category: "acquisition", cost_behavior: "fixed_monthly", is_active: true },
      { id: "archived-fee", name: "بوابة جديدة", category: "financial", cost_behavior: "fixed_monthly", is_active: false },
      { id: "unused-fee", name: "قديم", category: "financial", cost_behavior: "fixed_monthly", is_active: false },
    ],
    revenueEntries: [
      { revenue_stream_id: "active", gross_cash_collected: "5000", refunds: "0" },
      {
        revenue_stream_id: "archived",
        stream_name_snapshot: "VIP — تاريخ محفوظ",
        stream_type_snapshot: "other",
        gross_cash_collected: "2000",
        refunds: "200",
      },
    ],
    expenseEntries: [
      { expense_item_id: "fixed", input_value: "1500", customer_count_basis: null },
      {
        expense_item_id: "archived-fee",
        expense_name_snapshot: "رسوم قديمة",
        category_snapshot: "financial",
        cost_behavior_snapshot: "percentage_revenue",
        input_value: "0.03",
        customer_count_basis: null,
      },
    ],
  });

  assert.deepEqual(result.revenueRows.map((r) => r.id), ["active", "archived"]);
  assert.equal(result.revenueRows[1].name, "VIP — تاريخ محفوظ");
  assert.equal(result.revenueRows[1].active, false);
  assert.equal(result.revenueRows[0].refunds, "0");
  assert.deepEqual(result.expenseRows.map((r) => r.id), ["fixed", "archived-fee"]);
  assert.equal(result.expenseRows[1].name, "رسوم قديمة");
  assert.equal(result.expenseRows[1].behavior, "percentage_revenue");
  assert.equal(result.expenseRows[1].value, "3");
});

test("B09 keeps unpopulated inputs unknown rather than manufacturing zero", () => {
  assert.equal(monthlyInputValue(null), "");
  assert.equal(monthlyInputValue(undefined), "");
  assert.equal(monthlyInputValue(0), "0");
  const result = buildMonthlyEntryRows({
    streams: [{ id: "a", name: "New", stream_type: "other", is_active: true }],
    expenses: [{ id: "e", name: "Fees", category: "financial", cost_behavior: "percentage_revenue", is_active: true }],
    revenueEntries: [],
    expenseEntries: [],
  });
  assert.equal(result.revenueRows[0].gross, "");
  assert.equal(result.revenueRows[0].refunds, "");
  assert.equal(result.expenseRows[0].value, "");
});

const setupPage = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/setup/page.tsx", import.meta.url),
  "utf8",
);
const monthlyPage = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/monthly/page.tsx", import.meta.url),
  "utf8",
);
const firstMonthLoader = await readFile(
  new URL("../../src/lib/business/first-month-setup.ts", import.meta.url),
  "utf8",
);
const firstMonthUi = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/setup/first-month-setup-content.tsx", import.meta.url),
  "utf8",
);

test("B09 is a read-only data loader that reuses Monthly row mapping and customer derivation", () => {
  assert.match(firstMonthLoader, /loadTransactionDerivedMonthlyCustomerCounts/);
  assert.match(firstMonthLoader, /buildMonthlyEntryRows/);
  assert.match(monthlyPage, /buildMonthlyEntryRows/);
  assert.match(firstMonthLoader, /customerCountsResult\.dataLoadError/);
  assert.match(firstMonthLoader, /isSavedHistorical:/);
  assert.doesNotMatch(firstMonthLoader, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(firstMonthUi, /saveMonthlyActuals|save_monthly_actuals|<form action=\{/);
});

test("B09 Step 4 does not complete on draft input and has no independent save", () => {
  assert.match(setupPage, /firstMonth\?\.kind === "loaded"/);
  assert.match(setupPage, /resolveFirstMonthSelection\(query\.month/);
  assert.match(firstMonthUi, /معاينة غير محفوظة/);
  assert.match(firstMonthUi, /فتح الإدخال الشهري لحفظ الأرقام/);
  assert.match(firstMonthUi, /<MonthlyEntryForm/);
  assert.match(firstMonthUi, /editable=\{canManage && !firstMonth\.isSavedHistorical\}/);
  assert.doesNotMatch(firstMonthUi, /type="submit">حفظ|\.rpc\(/);
});
