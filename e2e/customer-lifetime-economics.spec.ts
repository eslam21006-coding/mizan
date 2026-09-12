import { expect, test, type Page, type Route } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-profile, content-type, prefer, range-profile",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "http://127.0.0.1:3000",
  "Access-Control-Expose-Headers": "Content-Range",
};

async function fulfillSupabaseJson(route: Route, body: unknown) {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

async function installLifetimeEconomicsMocks(page: Page) {
  await page.route("**/rest/v1/customer_lifetime_revenue_stream_analysis**", (route) =>
    fulfillSupabaseJson(route, [
      { business_id: "mock", revenue_stream_id: "stream-core", revenue_stream_name: "Core Offer", revenue_stream_type: "front_end", is_unattributed: false, cohort_count: 1, transaction_count: 3, customers_with_activity: 2, gross_cash_collected_text: "1800", refunds_text: "100", net_cash_collected_text: "1700", currency: "EGP" },
      { business_id: "mock", revenue_stream_id: "stream-backend", revenue_stream_name: "Backend", revenue_stream_type: "backend", is_unattributed: false, cohort_count: 1, transaction_count: 1, customers_with_activity: 1, gross_cash_collected_text: "500", refunds_text: "0", net_cash_collected_text: "500", currency: "EGP" },
      { business_id: "mock", revenue_stream_id: "stream-other", revenue_stream_name: "Other Revenue", revenue_stream_type: "other", is_unattributed: false, cohort_count: 1, transaction_count: 1, customers_with_activity: 1, gross_cash_collected_text: "150", refunds_text: "0", net_cash_collected_text: "150", currency: "EGP" },
      { business_id: "mock", revenue_stream_id: null, revenue_stream_name: null, revenue_stream_type: null, is_unattributed: true, cohort_count: 1, transaction_count: 1, customers_with_activity: 1, gross_cash_collected_text: "200", refunds_text: "0", net_cash_collected_text: "200", currency: "EGP" },
    ]),
  );

  await page.route("**/rest/v1/customer_lifetime_contribution_profit_display**", (route) =>
    fulfillSupabaseJson(route, [
      {
        business_id: "mock",
        cohort_month: "2026-03-01",
        observation_cutoff_date: "2026-08-31",
        original_cohort_size: 2,
        lifetime_net_cash_text: "3000",
        acquisition_costs_text: "0",
        variable_fulfillment_costs_text: "0",
        other_variable_costs_text: "0",
        variable_financial_costs_text: "0",
        lifetime_attributable_costs_text: "0",
        lifetime_contribution_profit_text: "3000",
        lifetime_contribution_profit_per_customer_text: "1500",
        currency: "EGP",
        quality_state: "actual",
        transaction_history_complete: true,
        missing_relevant_period_count: 0,
        incomplete_relevant_period_count: 0,
        estimated_relevant_period_count: 0,
        legacy_manual_allocation_count: 0,
        uses_automatic_allocation: false,
      },
      {
        business_id: "mock",
        cohort_month: "2026-01-01",
        observation_cutoff_date: "2026-08-31",
        original_cohort_size: 1,
        lifetime_net_cash_text: "10000",
        acquisition_costs_text: "2500",
        variable_fulfillment_costs_text: "1000",
        other_variable_costs_text: "500",
        variable_financial_costs_text: "300",
        lifetime_attributable_costs_text: "4300",
        lifetime_contribution_profit_text: "5700",
        lifetime_contribution_profit_per_customer_text: "5700",
        currency: "EGP",
        quality_state: "estimated",
        transaction_history_complete: true,
        missing_relevant_period_count: 0,
        incomplete_relevant_period_count: 0,
        estimated_relevant_period_count: 1,
        legacy_manual_allocation_count: 0,
        uses_automatic_allocation: true,
      },
      {
        business_id: "mock",
        cohort_month: "2026-08-01",
        observation_cutoff_date: "2026-08-31",
        original_cohort_size: 1,
        lifetime_net_cash_text: "6829",
        acquisition_costs_text: "2580",
        variable_fulfillment_costs_text: "6000",
        other_variable_costs_text: "0",
        variable_financial_costs_text: "428.41",
        lifetime_attributable_costs_text: "9008.41",
        lifetime_contribution_profit_text: null,
        lifetime_contribution_profit_per_customer_text: null,
        currency: "EGP",
        quality_state: "incomplete",
        transaction_history_complete: true,
        missing_relevant_period_count: 1,
        incomplete_relevant_period_count: 0,
        estimated_relevant_period_count: 1,
        legacy_manual_allocation_count: 0,
        uses_automatic_allocation: true,
      },
    ]),
  );
}

test.describe("Customer profitability UX", () => {
  test("shows automatic profitability states and calculation details without manual monthly allocation", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await installLifetimeEconomicsMocks(page);
    await page.goto("/auth/e2e-lifetime-economics");

    await expect(page.getByRole("heading", { name: "اختبار اقتصاديات العملاء" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "من أين جاء التحصيل؟" })).toBeVisible();

    const revenueStreamTable = page.getByRole("table", {
      name: "جدول تحليل مصادر الإيراد مدى الحياة",
    });
    const coreRow = revenueStreamTable.getByRole("row").filter({ hasText: "Core Offer" });
    const backendRow = revenueStreamTable.getByRole("row").filter({ hasText: "Backend" });
    const otherRow = revenueStreamTable.getByRole("row").filter({ hasText: "Other Revenue" });
    const unattributedRow = revenueStreamTable.getByRole("row").filter({ hasText: "يحتاج ربطًا يدويًا" });

    await expect(coreRow.locator("td").nth(6)).toHaveText("1,700 EGP");
    await expect(backendRow.locator("td").nth(6)).toHaveText("500 EGP");
    await expect(otherRow.locator("td").nth(1)).toHaveText("أخرى");
    await expect(unattributedRow.locator("td").nth(0)).toContainText("غير منسوب");

    await expect(
      page.getByRole("heading", { name: "كم حقق عملاء كل شهر بعد التكاليف المرتبطة بهم؟" }),
    ).toBeVisible();

    const contributionTable = page.getByRole("table", {
      name: "ربحية العملاء حسب شهر أول شراء",
    });
    const actualRow = contributionTable.getByRole("row").filter({ hasText: "2026-03-01" });
    const estimatedRow = contributionTable.getByRole("row").filter({ hasText: "2026-01-01" });
    const incompleteRow = contributionTable.getByRole("row").filter({ hasText: "2026-08-01" });

    await expect(actualRow.locator("td").nth(2)).toContainText("3,000 EGP");
    await expect(actualRow.locator("td").nth(3)).toHaveText("ربح 1,500 EGP");
    await expect(actualRow.locator("td").nth(4)).toContainText("فعلي");

    await expect(estimatedRow.locator("td").nth(2)).toContainText("10,000 EGP");
    await expect(estimatedRow.locator("td").nth(3)).toHaveText("ربح 5,700 EGP");
    await expect(estimatedRow.locator("td").nth(4)).toContainText("تقديري");

    await expect(incompleteRow.locator("td").nth(2)).toContainText("6,829 EGP");
    await expect(incompleteRow.locator("td").nth(3)).toHaveText("غير متاح حتى تكتمل البيانات");
    await expect(incompleteRow.locator("td").nth(4)).toContainText("غير مكتمل");

    await estimatedRow.getByText("عرض طريقة الحساب").click();
    await expect(estimatedRow.getByText("تكاليف الاكتساب الموزعة")).toBeVisible();
    await expect(estimatedRow.getByText("2,500 EGP", { exact: true })).toBeVisible();
    await expect(estimatedRow.getByText("إجمالي التكاليف المرتبطة بالعميل")).toBeVisible();
    await expect(estimatedRow.getByText("4,300 EGP", { exact: true })).toBeVisible();
    await expect(estimatedRow.getByText("ربح 5,700 EGP", { exact: true })).toBeVisible();
    await expect(estimatedRow.getByText(/لا تحتاج إلى إدخال توزيع شهري يدوي/)).toBeVisible();

    await incompleteRow.getByText("عرض طريقة الحساب").click();
    await expect(incompleteRow.getByText(/يوجد نشاط لعملاء في شهر لا توجد له بيانات مالية شهرية مكتملة/)).toBeVisible();
    await expect(incompleteRow.getByText("الربح المحقق للمجموعة حتى الآن")).toBeVisible();

    await expect(page.getByRole("heading", { name: "راجع التكاليف حسب شهر أول شراء" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "حفظ التكاليف بعد المراجعة" })).toHaveCount(0);
    await expect(page.getByText(/كوهورت/)).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("region", { name: "ربحية العملاء حسب شهر أول شراء — عرض الهاتف" }),
    ).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(browserErrors).toEqual([]);
  });
});
