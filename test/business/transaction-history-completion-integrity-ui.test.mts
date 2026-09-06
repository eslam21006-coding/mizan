import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const importPage = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/import/page.tsx",
  "utf8",
);
const importActions = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/import/actions.ts",
  "utf8",
);

test("history completion UI requires a persisted successful positive collection", () => {
  assert.match(importPage, /\.from\("customer_transactions"\)/);
  assert.match(importPage, /\.eq\("normalized_outcome", "successful"\)/);
  assert.match(importPage, /\.eq\("transaction_type", "collection"\)/);
  assert.match(importPage, /\.gt\("amount_collected", 0\)/);
  assert.match(importPage, /hasSavedCustomerPurchase/);
  assert.match(
    importPage,
    /canManage && !historyStatusError && hasSavedCustomerPurchase/,
  );
});

test("Arabic import UX distinguishes reviewing a file from actually saving transactions", () => {
  assert.match(importPage, /لم تُحفظ أي عملية شراء ناجحة بعد/);
  assert.match(importPage, /رفع الملف أو مراجعته لا يحفظ المعاملات/);
  assert.match(importPage, /اضغط «استيراد المعاملات» أولًا/);
  assert.match(importPage, /بعد حفظ أول عملية شراء سيصبح تأكيد اكتمال التاريخ متاحًا/);
});

test("server action surfaces the database saved-purchase guard instead of a generic failure", () => {
  assert.match(importActions, /error\?\.code === "MZ001"/);
  assert.match(importActions, /historyStatus=transactions-required/);
  assert.match(importPage, /status === "transactions-required"/);
  assert.match(importPage, /لا يمكن تأكيد اكتمال السجل قبل حفظ عملية شراء ناجحة واحدة على الأقل/);
});
