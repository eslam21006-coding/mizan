import { expect, test, type Page, type Route } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-profile, content-type, prefer, range-profile",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "http://127.0.0.1:3000",
  "Access-Control-Expose-Headers": "Content-Range",
};

/** Fulfills a mocked Supabase REST request with the same CORS and count headers used by the browser client. */
async function fulfillSupabaseJson(route: Route, body: unknown, contentRange = "0-0/1") {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { ...corsHeaders, "Content-Range": contentRange },
    body: JSON.stringify(body),
  });
}

/** Collects console and page errors so the RTL fixtures must render without hidden browser failures. */
function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("Founder customer UX: actionable incomplete states and Arabic RTL", () => {
  test("routes an incomplete profitability row to the exact remediation workflows", async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);

    await page.route("**/rest/v1/customer_lifetime_revenue_stream_analysis**", (route) =>
      fulfillSupabaseJson(route, [], "*/0"),
    );
    await page.route("**/rest/v1/customer_lifetime_contribution_profit_display**", (route) =>
      fulfillSupabaseJson(route, [
        {
          business_id: "mock",
          cohort_month: "2026-08-01",
          observation_cutoff_date: "2026-09-15",
          original_cohort_size: 45,
          lifetime_net_cash_text: "6829",
          acquisition_costs_text: "0",
          variable_fulfillment_costs_text: "0",
          other_variable_costs_text: "0",
          variable_financial_costs_text: "0",
          lifetime_attributable_costs_text: "0",
          lifetime_contribution_profit_text: null,
          lifetime_contribution_profit_per_customer_text: null,
          currency: "USD",
          quality_state: "incomplete",
          transaction_history_complete: false,
          missing_relevant_period_count: 1,
          incomplete_relevant_period_count: 0,
          estimated_relevant_period_count: 0,
          legacy_manual_allocation_count: 1,
          uses_automatic_allocation: false,
        },
      ]),
    );

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/auth/e2e-lifetime-economics");

    const table = page.getByRole("table", { name: "ربحية العملاء حسب شهر أول شراء" });
    await expect(table).toHaveAttribute("dir", "rtl");
    const row = table.getByRole("row").filter({ hasText: "2026-08-01" });
    await expect(row).toContainText("غير مكتمل");

    const statusCell = row.locator("td").nth(4);
    const visibleHistoryAction = statusCell.getByRole("link", { name: "إكمال سجل المعاملات" }).first();
    await expect(visibleHistoryAction).toHaveAttribute(
      "href",
      "/businesses/00000000-0000-4000-8000-000000000025/customers/import#history-completeness-title",
    );

    await row.getByText("عرض طريقة الحساب").click();
    const details = row.locator("details");
    await expect(details.getByText(/سجل معاملات العملاء غير مكتمل/)).toBeVisible();
    await expect(details.getByText(/لا توجد له بيانات مالية شهرية مكتملة/)).toBeVisible();
    await expect(details.getByText(/توزيعات يدوية قديمة/)).toBeVisible();
    await expect(details.getByRole("link", { name: "مراجعة ما ينقص وإكماله" })).toHaveAttribute(
      "href",
      "/businesses/00000000-0000-4000-8000-000000000025/customers/review",
    );

    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileRegion = page.getByRole("region", {
      name: "ربحية العملاء حسب شهر أول شراء — عرض الهاتف",
    });
    await expect(mobileRegion).toHaveAttribute("dir", "rtl");
    await expect(mobileRegion.getByRole("link", { name: "إكمال سجل المعاملات" }).first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);

    expect(browserErrors).toEqual([]);
  });

  test("keeps Arabic Observed LTV columns and cells visually right-to-left while isolating numbers", async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);

    await page.route("**/rest/v1/customer_observed_ltv**", (route) =>
      fulfillSupabaseJson(route, [
        {
          business_id: "mock",
          cohort_month: "2026-08-01",
          observation_cutoff_date: "2026-09-15",
          original_cohort_size: 45,
          cumulative_gross_cash_collected_text: "6829",
          cumulative_refunds_text: "0",
          cumulative_net_cash_collected_text: "6829",
          observed_ltv_text: "151.7555555556",
          currency: "USD",
        },
      ]),
    );

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/auth/e2e-customer-cohort-ux");

    const table = page.getByRole("table", { name: "قيمة العميل حسب شهر أول شراء" });
    await expect(table).toHaveAttribute("dir", "rtl");
    const headers = table.getByRole("columnheader");
    await expect(headers).toHaveCount(4);

    const headerXs = await headers.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().x),
    );
    expect(headerXs[0]).toBeGreaterThan(headerXs[1]);
    expect(headerXs[1]).toBeGreaterThan(headerXs[2]);
    expect(headerXs[2]).toBeGreaterThan(headerXs[3]);

    const dataRow = table.getByRole("row").filter({ hasText: "أغسطس" });
    const customerCell = dataRow.locator("td").nth(1);
    const netCashCell = dataRow.locator("td").nth(2);
    const observedLtvCell = dataRow.locator("td").nth(3);
    await expect(customerCell).toHaveCSS("direction", "rtl");
    await expect(netCashCell).toHaveCSS("direction", "rtl");
    await expect(observedLtvCell).toHaveCSS("direction", "rtl");
    await expect(customerCell.locator("bdi").first()).toHaveAttribute("dir", "ltr");
    await expect(netCashCell.locator("bdi").first()).toHaveAttribute("dir", "ltr");
    await expect(observedLtvCell.locator("bdi").first()).toHaveAttribute("dir", "ltr");

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileRegion = page.getByRole("region", {
      name: "قيمة العميل حسب شهر أول شراء — عرض الهاتف",
    });
    await expect(mobileRegion).toBeVisible();
    await expect(mobileRegion).toHaveAttribute("dir", "rtl");
    const firstMetric = mobileRegion.locator("dd").first();
    await expect(firstMetric).toHaveCSS("direction", "rtl");
    await expect(firstMetric.locator("bdi")).toHaveAttribute("dir", "ltr");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);

    expect(browserErrors).toEqual([]);
  });
});
