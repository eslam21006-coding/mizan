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
const customerGroupsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/customer-groups-table.tsx",
  "utf8",
);
const customerUxCss = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/customer-analysis-ux.module.css",
  "utf8",
);
const contributionSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/lifetime-contribution-table.tsx",
  "utf8",
);
const contributionManagerSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/lifetime-contribution/lifetime-contribution-allocation-manager.tsx",
  "utf8",
);
const contributionPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/lifetime-contribution/page.tsx",
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

test("customer redesign preserves locked financial meaning while removing redundant cohort-age language", () => {
  assert.match(observedLtvSource, /Observed LTV \/ قيمة العميل المحققة حتى الآن/);
  assert.match(observedLtvSource, /رقم محقق من المعاملات الفعلية، وليس توقعًا للمستقبل/);
  assert.match(
    observedLtvSource,
    /إجمالي صافي ما دفعوه من أول شراء وحتى تاريخ الحساب، وليس ما دفعوه داخل شهر البداية فقط/,
  );
  assert.match(observedLtvSource, /البيانات محسوبة حتى/);
  assert.match(observedLtvSource, /العملاء الذين بدأوا في هذا الشهر/);
  assert.match(observedLtvSource, /إجمالي ما دفعوه حتى الآن/);
  assert.match(observedLtvSource, /متوسط ما دفعه العميل حتى الآن/);
  assert.match(observedLtvSource, /observation_cutoff_date/);
  assert.doesNotMatch(observedLtvSource, /كوهورت/);
  assert.doesNotMatch(observedLtvSource, /مرّ منذ أول شراء/);
  assert.doesNotMatch(observedLtvSource, /بعد شهرين/);
  assert.doesNotMatch(observedLtvSource, /cohort_age_months/);
  assert.doesNotMatch(observedLtvSource, /months_observed/);
  assert.doesNotMatch(contributionSource, /كوهورت/);
  assert.doesNotMatch(contributionManagerSource, /كوهورت/);
  assert.doesNotMatch(contributionPageSource, /كوهورت/);
  assert.match(contributionSource, /المصروفات الشهرية الثابتة غير المرتبطة بالعميل تبقى في Real Net Profit ولا تخصم هنا/);
  assert.match(contributionSource, /Lifetime Contribution Profit \/ الربح المحقق من العميل حتى الآن/);
  assert.match(contributionSource, /فعلي/);
  assert.match(contributionSource, /تقديري/);
  assert.match(contributionSource, /غير مكتمل/);
  assert.match(contributionSource, /عرض طريقة الحساب/);
  assert.match(contributionManagerSource, /ليست راتبًا شهريًا ثابتًا أو تكلفة Fixed Monthly/);
  assert.match(contributionManagerSource, /توزيع من تكلفة مشتركة \(تقديري\)/);
  assert.match(contributionManagerSource, /خسارة بعد التكاليف حتى الآن/);
  assert.match(shellSource, /العملاء وقيمة وربحية العميل/);
  assert.match(shellSource, /لا تحتاج إلى توزيع التكاليف يدويًا لكل شهر أول شراء/);
  assert.match(shellSource, /ميزان يستخدم تصنيف وسلوك المصروفات الشهرية/);
  assert.doesNotMatch(shellSource, /href={`\/businesses\/\$\{businessId\}\/customers\/lifetime-contribution`}/);
});

test("analysis navigation is an accessible RTL tab interface with a strong active state", () => {
  assert.match(tabsSource, /role="tablist"/);
  assert.match(tabsSource, /role="tab"/);
  assert.match(tabsSource, /role="tabpanel"/);
  assert.match(tabsSource, /aria-selected/);
  assert.match(tabsSource, /ArrowLeft/);
  assert.match(tabsSource, /ArrowRight/);
  assert.match(tabsSource, /analysisTabActiveEmphasis/);
  assert.match(customerUxCss, /\.analysisTabActiveEmphasis\s*\{[\s\S]*?background:\s*var\(--brand-strong\)/);
  assert.doesNotMatch(shellSource, /createSupabase/);
  assert.doesNotMatch(tabsSource, /createSupabase/);
});

test("customer ledger exposes literal server-side name-or-email search filters and sorting without changing customer identity", () => {
  assert.match(customerGroupsSource, /ابحث بالاسم أو البريد الإلكتروني/);
  assert.match(customerGroupsSource, /اشتروا أكثر من مرة/);
  assert.match(customerGroupsSource, /أعلى صافي تحصيل/);
  assert.match(customerGroupsSource, /\.gt\("collection_count", 1\)/);
  assert.match(customerGroupsSource, /function escapeIlikeLiteral/);
  assert.match(customerGroupsSource, /replaceAll\("\\\\", "\\\\\\\\"\)/);
  assert.match(customerGroupsSource, /replaceAll\("%", "\\\\%"\)/);
  assert.match(customerGroupsSource, /replaceAll\("_", "\\\\_"\)/);
  assert.match(customerGroupsSource, /\.ilike\("customer_search_text", `%\$\{escapeIlikeLiteral\(search\)\}%`\)/);
  assert.match(customerGroupsSource, /\.order\("net_cash_collected"/);
  assert.match(customerGroupsSource, /<th scope="col">العميل<\/th>/);
  assert.match(customerGroupsSource, /customer_name/);
  assert.match(customerGroupsSource, /كل بريد إلكتروني يمثل عميلًا واحدًا داخل هذا البزنس/);
});
