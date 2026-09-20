import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const monthlyShellSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/monthly-navigation-shell.tsx",
  "utf8",
);

test("Monthly uses the shared deterministic hierarchy instead of a generic Businesses back link", () => {
  assert.match(monthlyPageSource, /<MonthlyNavigationShell/);
  assert.doesNotMatch(monthlyPageSource, /href="\/businesses"[\s\S]*العودة للبزنسات/);
  assert.match(monthlyShellSource, /<Breadcrumb items=\{breadcrumbItems\}/);
  assert.match(monthlyShellSource, /label="العودة إلى البزنس"/);
  assert.match(monthlyShellSource, /route: "business-overview", businessId/);
});

test("Monthly shell exposes the existing passive business context without changing workflow Return", () => {
  assert.match(monthlyShellSource, /<BusinessContext/);
  assert.match(monthlyShellSource, /businessName=\{businessName\}/);
  assert.match(monthlyShellSource, /baseCurrency=\{baseCurrency\}/);
  assert.match(monthlyShellSource, /timezone=\{timezone\}/);
  assert.match(monthlyPageSource, /<ReturnContextBanner/);
  assert.match(monthlyPageSource, /returnLabel="العودة إلى ربحية العميل"/);
});
