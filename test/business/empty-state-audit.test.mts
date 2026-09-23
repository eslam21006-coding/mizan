import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const home = source("src/app/(app)/page.tsx");
const businessOverview = source(
  "src/app/(app)/businesses/[businessId]/business-overview-panel.tsx",
);
const monthly = source("src/app/(app)/businesses/[businessId]/monthly/page.tsx");
const revenue = source("src/app/(app)/businesses/[businessId]/revenue-streams/page.tsx");
const expenses = source("src/app/(app)/businesses/[businessId]/expenses/page.tsx");
const funnels = source("src/app/(app)/businesses/[businessId]/funnels/page.tsx");
const customers = source(
  "src/app/(app)/businesses/[businessId]/customers/customer-groups-table.tsx",
);
const cohorts = source(
  "src/app/(app)/businesses/[businessId]/customers/customer-cohort-ltv-table.tsx",
);
const profitability = source(
  "src/app/(app)/businesses/[businessId]/customers/lifetime-contribution-table.tsx",
);
const simulator = source("src/app/(app)/simulator/simulator-workspace.tsx");
const targetPlanner = source("src/app/(app)/target-plan/page.tsx");
const insights = source("src/app/(app)/insights/decision-insights-panel.tsx");
const analytics = source("src/app/(app)/analytics/page.tsx");
const settings = source("src/app/(app)/settings/page.tsx");

test("N62 keeps every major empty-state surface connected to a meaningful next action", () => {
  assert.match(home, /إعداد أول بزنس/);
  assert.match(businessOverview, /health\.nextAction/);
  assert.match(monthly, /إدارة مصادر الإيراد/);
  assert.match(monthly, /إدارة هيكل المصروفات/);

  assert.match(revenue, /هذا متوقع في البزنس الجديد/);
  assert.match(revenue, /mode="create"/);
  assert.match(expenses, /هذا متوقع في البزنس الجديد/);
  assert.match(expenses, /mode="create"/);

  assert.match(funnels, /هذا طبيعي\. الفانلز اختيارية/);
  assert.match(funnels, /FunnelCreateDrawerLauncher/);

  assert.match(customers, /استيراد معاملات/);
  assert.match(customers, /مسح البحث والفلاتر/);
  assert.match(cohorts, /canManage \?/);
  assert.match(cohorts, /استيراد معاملات/);
  assert.match(cohorts, /العودة إلى نظرة عامة/);
  assert.match(profitability, /canManage \?/);
  assert.match(profitability, /استيراد معاملات/);
  assert.match(profitability, /العودة إلى نظرة عامة/);
  assert.match(profitability, /مراجعة البيانات الشهرية/);

  assert.match(simulator, /canManage \? "فتح أرقام الفانلز" : "مراجعة أرقام الفانلز"/);
  assert.match(simulator, /canManage \? "إكمال أرقام الفانلز" : "مراجعة أرقام الفانلز"/);
  assert.match(targetPlanner, /تحديد الهدف/);
  assert.match(insights, /مراجعة التحليلات/);
  assert.match(analytics, /عرض الاتجاهات التاريخية/);
  assert.match(analytics, /view=trends&period=ytd/);
  assert.match(settings, /إعداد أول بزنس/);
});

test("N62 empty states explain why data is absent instead of treating missing data as zero", () => {
  assert.match(home, /لن نفترض إيرادًا أو مصروفًا أو عدد عملاء/);
  assert.match(customers, /هذا لا يعني أن سجل العملاء فارغ/);
  assert.match(cohorts, /لا ينشئ Cohort أو قيمة عميل من دون معاملات فعلية/);
  assert.match(profitability, /لا يقدّر ربحية عميل من دون أساس فعلي/);
  assert.match(simulator, /ميزان لن يخترع نسبًا بديلة/);
  assert.match(insights, /لا يحول البيانات المفقودة إلى صفر/);
  assert.match(analytics, /لن نعتبره\s*صفرًا/);
});


test("N62 keeps the browser-only empty-state fixture request-time gated", () => {
  const fixture = source("src/app/auth/e2e-empty-state-audit/page.tsx");
  assert.match(fixture, /import \{ connection \} from "next\/server"/);
  assert.match(fixture, /export default async function EmptyStateAuditFixture/);
  assert.match(fixture, /await connection\(\)/);
  assert.match(fixture, /process\.env\.MIZAN_E2E_UI_FIXTURE/);
});


test("N62 hides mutation-oriented empty-state actions from read-only customer viewers", () => {
  const customerPage = source("src/app/(app)/businesses/[businessId]/customers/page.tsx");
  assert.match(customerPage, /requireAuthContext/);
  assert.match(customerPage, /owner_user_id/);
  assert.match(customerPage, /canManage=\{canManage\}/);
});
