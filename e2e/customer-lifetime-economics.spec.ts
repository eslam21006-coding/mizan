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
      { business_id: "mock", cohort_month: "2026-01-01", observation_cutoff_date: "2026-08-26", original_cohort_size: 1, lifetime_net_cash_text: "10000", attributable_costs_text: "4300", acquisition_costs_text: "2500", variable_fulfillment_costs_text: "1000", other_variable_costs_text: "500", payment_processing_costs_text: "300", allocation_complete: true, uses_explicit_allocation: true, lifetime_contribution_profit_text: "5700", lifetime_contribution_profit_per_customer_text: "5700", currency: "EGP" },
      { business_id: "mock", cohort_month: "2026-08-01", observation_cutoff_date: "2026-08-31", original_cohort_size: 1, lifetime_net_cash_text: "6829", attributable_costs_text: "9008.41", acquisition_costs_text: "2580", variable_fulfillment_costs_text: "6000", other_variable_costs_text: "0", payment_processing_costs_text: "428.41", allocation_complete: true, uses_explicit_allocation: true, lifetime_contribution_profit_text: "-2179.41", lifetime_contribution_profit_per_customer_text: "-2179.41", currency: "EGP" },
    ]),
  );

  await page.route("**/rest/v1/customer_cohort_cost_allocation_display**", (route) =>
    fulfillSupabaseJson(route, [
      { business_id: "mock", cohort_month: "2026-01-01", cost_type: "acquisition", amount_text: "2500", attribution_method: "direct_actual", note: "Acquisition", eligibility_confirmed: true },
      { business_id: "mock", cohort_month: "2026-01-01", cost_type: "variable_fulfillment", amount_text: "1000", attribution_method: "explicit_allocation", note: "Variable fulfillment", eligibility_confirmed: true },
      { business_id: "mock", cohort_month: "2026-01-01", cost_type: "other_variable", amount_text: "500", attribution_method: "direct_actual", note: "Other variable", eligibility_confirmed: true },
      { business_id: "mock", cohort_month: "2026-01-01", cost_type: "payment_processing", amount_text: "300", attribution_method: "direct_actual", note: "Processor", eligibility_confirmed: true },
      { business_id: "mock", cohort_month: "2026-08-01", cost_type: "acquisition", amount_text: "2580", attribution_method: "direct_actual", note: "Meta Ads", eligibility_confirmed: true },
      { business_id: "mock", cohort_month: "2026-08-01", cost_type: "variable_fulfillment", amount_text: "6000", attribution_method: "explicit_allocation", note: "Reviewed variable example", eligibility_confirmed: true },
      { business_id: "mock", cohort_month: "2026-08-01", cost_type: "other_variable", amount_text: "0", attribution_method: "direct_actual", note: null, eligibility_confirmed: false },
      { business_id: "mock", cohort_month: "2026-08-01", cost_type: "payment_processing", amount_text: "428.41", attribution_method: "direct_actual", note: "Stripe", eligibility_confirmed: true },
    ]),
  );
}

test.describe("Tasks 24-25 lifetime customer economics", () => {
  test("shows founder-facing lifetime profitability without cohort jargon or negative-profit wording", async ({ page }) => {
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
    await expect(otherRow.locator("td").nth(6)).toHaveText("150 EGP");
    await expect(unattributedRow.locator("td").nth(0)).toContainText("غير منسوب");
    await expect(unattributedRow.locator("td").nth(6)).toHaveText("200 EGP");

    await expect(page.getByRole("heading", { name: "ربحية العملاء بعد التكاليف" })).toBeVisible();
    const contributionTable = page.getByRole("table", {
      name: "جدول ربحية العملاء بعد التكاليف",
    });
    const positiveRow = contributionTable.getByRole("row").filter({ hasText: "2026-01-01" });
    const lossRow = contributionTable.getByRole("row").filter({ hasText: "2026-08-01" });
    await expect(positiveRow.locator("td").nth(2)).toHaveText("10,000 EGP");
    await expect(positiveRow.locator("td").nth(4)).toHaveText("ربح 5,700 EGP");
    await expect(positiveRow.locator("td").nth(6)).toContainText("توزيعًا تقديريًا صريحًا");
    await expect(lossRow.locator("td").nth(2)).toHaveText("6,829 EGP");
    await expect(lossRow.locator("td").nth(4)).toHaveText("خسارة 2,179.41 EGP");
    await expect(lossRow.locator("td").nth(5)).toHaveText("خسارة 2,179.41 EGP");
    await expect(page.getByText(/الرواتب الشهرية الثابتة/).first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "راجع التكاليف حسب شهر أول شراء" })).toBeVisible();
    const augustCard = page.locator("article").filter({ hasText: "2026-08-01" });
    await expect(augustCard.getByText("خسارة بعد التكاليف حتى الآن")).toBeVisible();
    await expect(augustCard.getByText("2,179.41 EGP", { exact: true })).toBeVisible();

    const variableCostInput = page.getByRole("textbox", {
      name: "تكاليف خدمة العميل المتغيرة 2026-08-01",
      exact: true,
    });
    await variableCostInput.fill("6001");
    const saveButton = augustCard.getByRole("button", { name: "حفظ التكاليف بعد المراجعة" });
    await expect(saveButton).toBeDisabled();
    await expect(augustCard.getByText(/لم تتم مراجعة أهليته/)).toBeVisible();
    await page
      .getByRole("checkbox", {
        name: "تأكيد أهلية تكاليف خدمة العميل المتغيرة 2026-08-01",
        exact: true,
      })
      .check();
    await expect(saveButton).toBeEnabled();

    await expect(page.getByText(/كوهورت/)).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(browserErrors).toEqual([]);
  });
});
