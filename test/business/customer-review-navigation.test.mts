import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const customerPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/page.tsx",
  "utf8",
);
const customerShellSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/customer-overview-shell.tsx",
  "utf8",
);
const reviewNoticeSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/customer-review-notice.tsx",
  "utf8",
);
const reviewPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/review/page.tsx",
  "utf8",
);
const reviewNavigationSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/review/customer-review-navigation.tsx",
  "utf8",
);
const reviewPanelSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/review/customer-economics-review-panel.tsx",
  "utf8",
);

test("Customer overview derives contextual Review state from both authoritative exception sources", () => {
  assert.match(customerPageSource, /customer_economics_review_exceptions/);
  assert.match(customerPageSource, /customer_economics_missing_period_exceptions/);
  assert.match(customerPageSource, /reviewLoadError/);
  assert.match(customerPageSource, /reviewIssueCount/);
  assert.match(customerShellSource, /CustomerReviewNotice/);
});

test("Review notice hides clean state but fails open to Review when status is uncertain", () => {
  assert.match(reviewNoticeSource, /if \(!loadError && \(issueCount \?\? 0\) <= 0\)/);
  assert.match(reviewNoticeSource, /تعذر التحقق من حالة المراجعة/);
  assert.match(reviewNoticeSource, /business-customer-review/);
  assert.match(reviewNoticeSource, /فتح المراجعة/);
});

test("Review success shell uses deterministic breadcrumb and Back hierarchy", () => {
  assert.match(reviewPageSource, /CustomerReviewNavigation/);
  assert.match(reviewNavigationSource, /Breadcrumb/);
  assert.match(reviewNavigationSource, /BackLink/);
  assert.match(reviewNavigationSource, /route: "business-customers"/);
  assert.match(reviewNavigationSource, /العملاء وقيمة العميل/);
  assert.match(reviewNavigationSource, /المراجعة/);
});

test("Review data-load errors preserve hierarchy and use the standard in-page error state", () => {
  assert.match(reviewPageSource, /if \(dataLoadError\)/);
  assert.match(reviewPageSource, /CustomerReviewNavigation/);
  assert.match(reviewPageSource, /InPageErrorState/);
  assert.match(reviewPageSource, /تعذر تحميل بيانات المراجعة/);
  assert.match(reviewPageSource, /retryAction/);
  assert.match(reviewPageSource, /business-customer-review/);
});

test("Review missing-month remediation resolves the exact month through typed Monthly navigation", () => {
  assert.match(reviewPanelSource, /BUSINESS_NET_CASH_MISSING/);
  assert.match(reviewPanelSource, /monthlyReviewHref/);
  assert.match(reviewPanelSource, /route: "business-monthly"/);
  assert.match(reviewPanelSource, /month: activityMonth\.slice\(0, 7\)/);
  assert.doesNotMatch(reviewPanelSource, /monthly\?month=\$\{exception\.activity_month\.slice/);
});
