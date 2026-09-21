import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const correctionActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/correction/actions.ts",
  "utf8",
);
const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const successSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/historical-correction-success.tsx",
  "utf8",
);

test("N34 returns successful historical corrections to the exact Monthly month", () => {
  assert.match(
    correctionActionsSource,
    /new URLSearchParams\(\{ month: monthKey, status: "corrected" \}\)/,
  );
  assert.match(
    correctionActionsSource,
    /redirect\(\`\/businesses\/\$\{businessId\}\/monthly\?\$\{query\.toString\(\)\}\`\)/,
  );
  assert.match(
    correctionActionsSource,
    /if \(error\) redirectCorrection\(businessId, month\.monthKey, "correction-failed"\)/,
  );
  assert.match(
    correctionActionsSource,
    /redirectCorrectionSuccess\(businessId, month\.monthKey\)/,
  );
  assert.doesNotMatch(
    correctionActionsSource,
    /redirectCorrection\(businessId, month\.monthKey, "corrected"\)/,
  );
});

test("N34 only shows correction success on a saved historical Monthly month", () => {
  assert.match(
    monthlyPageSource,
    /const isHistoricalCorrectionSuccess = query\.status === "corrected" && isSavedHistorical/,
  );
  assert.match(monthlyPageSource, /<HistoricalCorrectionSuccess monthLabel=\{monthLabel\} \/>/);
  assert.match(successSource, /role="status"/);
  assert.match(successSource, /aria-label="تأكيد التصحيح التاريخي"/);
  assert.match(successSource, /تم حفظ التصحيح التاريخي/);
  assert.match(successSource, /سبب التصحيح ونسخة قبل وبعد/);
  assert.match(successSource, /العرض التاريخي للشهر/);
});
