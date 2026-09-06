import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/page.tsx",
  "utf8",
);
const shellSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/customer-overview-shell.tsx",
  "utf8",
);
const tabsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/customer-analysis-tabs.tsx",
  "utf8",
);
const observedLtvSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/customer-cohort-ltv-table.tsx",
  "utf8",
);
const contributionSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/lifetime-contribution-table.tsx",
  "utf8",
);

test("customer overview keeps all four existing analyses behind one focused workspace", () => {
  assert.match(pageSource, /CustomerOverviewShell/);
  assert.match(pageSource, /CustomerCohortLtvTable/);
  assert.match(pageSource, /LifetimeRevenueStreamTable/);
  assert.match(pageSource, /LifetimeContributionTable/);
  assert.match(pageSource, /CustomerGroupsTable/);
  assert.match(shellSource, /id: "observed-ltv"/);
  assert.match(shellSource, /id: "revenue-streams"/);
  assert.match(shellSource, /id: "contribution"/);
  assert.match(shellSource, /id: "customers"/);
});

test("customer redesign preserves the locked LTV and contribution terminology", () => {
  assert.match(observedLtvSource, /Observed LTV \/ قيمة العميل المحققة حتى الآن/);
  assert.match(observedLtvSource, /وليست توقعًا للقيمة النهائية للعميل/);
  assert.match(contributionSource, /المصاريف العامة الثابتة غير داخلة في هذا المقياس/);
  assert.match(shellSource, /ميزان لا يحوّل إيراد فترة واحدة إلى LTV/);
});

test("analysis navigation is an accessible RTL tab interface and remains presentation-only", () => {
  assert.match(tabsSource, /role="tablist"/);
  assert.match(tabsSource, /role="tab"/);
  assert.match(tabsSource, /role="tabpanel"/);
  assert.match(tabsSource, /aria-selected/);
  assert.match(tabsSource, /ArrowLeft/);
  assert.match(tabsSource, /ArrowRight/);
  assert.doesNotMatch(shellSource, /createSupabase/);
  assert.doesNotMatch(tabsSource, /createSupabase/);
});
