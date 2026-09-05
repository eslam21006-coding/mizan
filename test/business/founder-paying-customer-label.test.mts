import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const monthlyEntrySource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/monthly-entry-form.tsx",
  "utf8",
);
const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);

test("monthly entry uses the explicit paying-customer label consistently", () => {
  for (const source of [monthlyEntrySource, monthlyPageSource]) {
    assert.match(source, /إجمالي العملاء الذين دفعوا خلال الشهر/);
    assert.doesNotMatch(source, /إجمالي العملاء الدافعين/);
  }
});
