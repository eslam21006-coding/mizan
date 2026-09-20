import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profitabilitySource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/lifetime-contribution-table.tsx",
  "utf8",
);
const reviewPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/review/page.tsx",
  "utf8",
);
const reviewPanelSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/review/customer-economics-review-panel.tsx",
  "utf8",
);
const reviewActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/review/actions.ts",
  "utf8",
);
const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const monthlyActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/actions.ts",
  "utf8",
);

/** Locks the customer-profitability detour to structured origin metadata instead of arbitrary return URLs. */
test("profitability remediation carries only the allow-listed customer-profitability origin", () => {
  assert.match(profitabilitySource, /customers\/review\?origin=customer-profitability/);
  assert.match(reviewPageSource, /parseReturnOrigin\(\{ origin: query\.origin \}\)/);
  assert.match(reviewPageSource, /parsedOrigin\?\.origin === "customer-profitability"/);
  assert.match(reviewPageSource, /ReturnContextBanner/);
  assert.doesNotMatch(profitabilitySource, /returnTo/);
  assert.doesNotMatch(reviewPageSource, /returnTo/);
});

/** Locks Review-to-Monthly remediation to the exact missing month while preserving the safe origin. */
test("Review carries profitability context into the exact Monthly fix", () => {
  assert.match(reviewPanelSource, /route: "business-monthly"/);
  assert.match(reviewPanelSource, /month: activityMonth\.slice\(0, 7\)/);
  assert.match(reviewPanelSource, /origin=\$\{encodeURIComponent\(returnOrigin\.origin\)\}/);
  assert.match(reviewPageSource, /returnOrigin=\{returnOrigin\}/);
});

/** Locks Review mutations to validated origin metadata so their redirects do not break the profitability return loop. */
test("Review mutations preserve only the safe profitability origin across validation, failure, and success", () => {
  assert.match(reviewPanelSource, /name="origin" value=\{returnOrigin\.origin\}/);
  assert.match(reviewActionsSource, /function parseReviewReturnOrigin/);
  assert.match(reviewActionsSource, /parseReturnOrigin\(\{ origin: rawOrigin \}\)/);
  assert.match(reviewActionsSource, /query\.set\("origin", returnOrigin\.origin\)/);
  assert.match(reviewActionsSource, /redirectReview\(businessId, "override-failed", returnOrigin\)/);
  assert.match(reviewActionsSource, /redirectReview\(businessId, "override-saved", returnOrigin\)/);
  assert.match(reviewActionsSource, /redirectReview\(businessId, "legacy-failed", returnOrigin\)/);
  assert.match(reviewActionsSource, /redirectReview\(businessId, "legacy-reconciled", returnOrigin\)/);
  assert.doesNotMatch(reviewActionsSource, /returnTo/);
});

/** Locks Monthly save redirects to the same structured origin so Return remains available after Save. */
test("Monthly preserves profitability origin through normal save redirects and renders Return", () => {
  assert.match(monthlyPageSource, /parseReturnOrigin\(\{ origin: query\.origin, month: query\.month \}\)/);
  assert.match(monthlyPageSource, /<ReturnContextBanner/);
  assert.match(monthlyPageSource, /name="origin" value=\{returnOrigin\.origin\}/);
  assert.match(monthlyActionsSource, /function parseMonthlyReturnOrigin/);
  assert.match(monthlyActionsSource, /parseReturnOrigin\(\{ origin: rawOrigin, month: rawMonth \}\)/);
  assert.match(monthlyActionsSource, /redirectMonthly\(businessId, month\.monthKey, "saved", returnOrigin\)/);
  assert.match(monthlyActionsSource, /redirectMonthly\(businessId, month\.monthKey, "save-failed", returnOrigin\)/);
  assert.doesNotMatch(monthlyPageSource, /returnTo/);
  assert.doesNotMatch(monthlyActionsSource, /returnTo/);
});
