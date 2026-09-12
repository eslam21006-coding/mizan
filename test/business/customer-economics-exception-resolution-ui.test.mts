import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reviewActions = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/customers/review/actions.ts",
    import.meta.url,
  ),
  "utf8",
);
const reviewPanel = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/customers/review/customer-economics-review-panel.tsx",
    import.meta.url,
  ),
  "utf8",
);
const correctionActions = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/monthly/correction/actions.ts",
    import.meta.url,
  ),
  "utf8",
);
const correctionPage = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/monthly/correction/page.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("Task 5 founder review UI calls only the guarded exception-resolution RPCs", () => {
  assert.match(reviewActions, /save_customer_economics_manual_override/);
  assert.match(reviewActions, /reconcile_customer_economics_legacy_allocations/);
  assert.match(reviewActions, /requireAuthContext\(\)/);
  assert.match(reviewPanel, /ملاحظات تحتاج مراجعتك/);
  assert.match(reviewPanel, /لا يتم إنشاء مصروفات جديدة هنا/);
  assert.match(reviewPanel, /يجب أن يساوي مجموع التوزيع التكلفة الفعلية بالضبط/);
});

test("Task 5 historical correction UI cannot silently fall back to the ordinary save RPC", () => {
  assert.match(correctionActions, /correct_historical_monthly_actuals/);
  assert.doesNotMatch(correctionActions, /\.rpc\("save_monthly_actuals"/);
  assert.match(correctionActions, /target_correction_reason/);
  assert.match(correctionPage, /تصحيح تاريخي صريح/);
  assert.match(correctionPage, /التصحيح التاريخي لا ينشئ شهرًا مفقودًا/);
});
