import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const hasLiveAuth = Boolean(liveEmail && livePassword);

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(liveEmail);
  await page.getByLabel("كلمة المرور").fill(livePassword);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("Tasks 24-25 lifetime customer economics", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan E2E credentials");

  test("shows lifetime revenue streams and contribution profit in Arabic RTL", async ({ page }) => {
    test.setTimeout(120_000);
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    const suffix = Date.now();
    const businessName = `Lifetime economics ${suffix}`;

    await login(page);
    await page.goto("/businesses/new");
    await page.getByLabel("اسم البزنس").fill(businessName);
    await page.getByLabel("اسم البزنس").press("Enter");
    await page.getByRole("button", { name: /EGP/ }).click();
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByLabel("المنطقة الزمنية").selectOption("Africa/Cairo");
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByRole("button", { name: "إنشاء البزنس" }).click();
    await expect(page).toHaveURL(/\/businesses\?status=created$/);

    await page.route("**/rest/v1/customer_observed_ltv**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", headers: { "Content-Range": "0-0/1" }, body: "[]" }),
    );
    await page.route("**/rest/v1/customer_transaction_groups**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", headers: { "Content-Range": "0-0/0" }, body: "[]" }),
    );
    await page.route("**/rest/v1/customer_lifetime_revenue_stream_analysis**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { business_id: "mock", revenue_stream_id: "stream-core", revenue_stream_name: "Core Offer", revenue_stream_type: "front_end", is_unattributed: false, cohort_count: 1, transaction_count: 3, customers_with_activity: 2, gross_cash_collected_text: "1800", refunds_text: "100", net_cash_collected_text: "1700", currency: "EGP" },
          { business_id: "mock", revenue_stream_id: "stream-backend", revenue_stream_name: "Backend", revenue_stream_type: "backend", is_unattributed: false, cohort_count: 1, transaction_count: 1, customers_with_activity: 1, gross_cash_collected_text: "500", refunds_text: "0", net_cash_collected_text: "500", currency: "EGP" },
          { business_id: "mock", revenue_stream_id: null, revenue_stream_name: null, revenue_stream_type: null, is_unattributed: true, cohort_count: 1, transaction_count: 1, customers_with_activity: 1, gross_cash_collected_text: "200", refunds_text: "0", net_cash_collected_text: "200", currency: "EGP" },
        ]),
      }),
    );
    await page.route("**/rest/v1/customer_lifetime_contribution_profit_display**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { business_id: "mock", cohort_month: "2026-01-01", observation_cutoff_date: "2026-08-26", original_cohort_size: 1, lifetime_net_cash_text: "10000", attributable_costs_text: "4300", acquisition_costs_text: "2500", variable_fulfillment_costs_text: "1000", other_variable_costs_text: "500", payment_processing_costs_text: "300", allocation_complete: true, uses_explicit_allocation: true, lifetime_contribution_profit_text: "5700", lifetime_contribution_profit_per_customer_text: "5700", currency: "EGP" },
        ]),
      }),
    );

    await page.goto("/customers");
    const card = page.locator("article").filter({ hasText: businessName });
    await card.getByRole("link", { name: "تجميع العملاء" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "تحليل مصادر الإيراد مدى الحياة" })).toBeVisible();
    await expect(page.getByText("1700 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("500 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("غير منسوب", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Lifetime Contribution Profit / ربح المساهمة مدى الحياة" }),
    ).toBeVisible();
    await expect(page.getByText("5700 EGP", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("يتضمن توزيعًا يدويًا", { exact: true })).toBeVisible();
    await expect(page.getByText(/المصاريف العامة الثابتة غير داخلة/)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(browserErrors).toEqual([]);
  });
});
