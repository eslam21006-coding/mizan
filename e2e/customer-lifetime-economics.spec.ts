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
    ]),
  );
}

test.describe("Tasks 24-25 lifetime customer economics", () => {
  test("shows lifetime revenue streams and contribution profit in Arabic RTL", async ({ page }) => {
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
    await expect(page.getByRole("heading", { name: "تحليل مصادر الإيراد مدى الحياة" })).toBeVisible();

    const revenueStreamTable = page.getByRole("table", {
      name: "جدول تحليل مصادر الإيراد مدى الحياة",
    });
    await expect(revenueStreamTable.getByText("1700 EGP", { exact: true })).toBeVisible();
    await expect(revenueStreamTable.getByText("500 EGP", { exact: true })).toBeVisible();
    await expect(revenueStreamTable.getByText("150 EGP", { exact: true })).toBeVisible();
    await expect(revenueStreamTable.getByText("أخرى", { exact: true })).toBeVisible();
    await expect(revenueStreamTable.getByText("غير منسوب", { exact: true }).first()).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Lifetime Contribution Profit / ربح المساهمة مدى الحياة" }),
    ).toBeVisible();
    const contributionTable = page.getByRole("table", {
      name: "جدول ربح المساهمة مدى الحياة",
    });
    await expect(contributionTable.getByText("5700 EGP", { exact: true }).first()).toBeVisible();
    await expect(contributionTable.getByText("يتضمن توزيعًا يدويًا", { exact: true })).toBeVisible();
    await expect(page.getByText(/المصاريف العامة الثابتة غير داخلة/)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(browserErrors).toEqual([]);
  });
});
