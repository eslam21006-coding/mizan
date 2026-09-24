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

const JOURNEY_BUSINESS_ID = "00000000-0000-4000-8000-000000000025";

/** Redirects production-shaped workflow links into authenticated E2E fixtures while preserving their structured query state. */
async function installIncompleteProfitabilityJourneyRedirects(page: Page) {
  await page.route(`**/businesses/${JOURNEY_BUSINESS_ID}/customers/review?**`, async (route) => {
    const url = new URL(route.request().url());
    const fixtureUrl = new URL("/auth/e2e-customer-economics-review", url.origin);
    for (const [key, value] of url.searchParams) fixtureUrl.searchParams.append(key, value);
    fixtureUrl.searchParams.set("businessId", JOURNEY_BUSINESS_ID);
    await route.continue({ url: fixtureUrl.toString() });
  });

  await page.route(`**/businesses/${JOURNEY_BUSINESS_ID}/monthly?**`, async (route) => {
    const url = new URL(route.request().url());
    await route.continue({ url: `${url.origin}/auth/e2e-monthly-entry${url.search}` });
  });

  await page.route(`**/businesses/${JOURNEY_BUSINESS_ID}/customers?**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("view") !== "profitability") {
      await route.continue();
      return;
    }
    const fixtureUrl = new URL("/auth/e2e-lifetime-economics", url.origin);
    for (const [key, value] of url.searchParams) {
      if (key !== "view") fixtureUrl.searchParams.append(key, value);
    }
    await route.continue({ url: fixtureUrl.toString() });
  });
}

/** Requires every stage of the mobile journey to remain within the viewport width. */
async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
}

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
      "/businesses/00000000-0000-4000-8000-000000000025/customers/review?origin=customer-profitability",
    );

    await page.goto("/auth/e2e-lifetime-economics?month=2026-07");
    const monthAwareTable = page.getByRole("table", { name: "ربحية العملاء حسب شهر أول شراء" });
    const monthAwareRow = monthAwareTable.getByRole("row").filter({ hasText: "2026-08-01" });
    await monthAwareRow.getByText("عرض طريقة الحساب").click();
    await expect(
      monthAwareRow
        .locator("details")
        .getByRole("link", { name: "مراجعة ما ينقص وإكماله" }),
    ).toHaveAttribute(
      "href",
      "/businesses/00000000-0000-4000-8000-000000000025/customers/review?origin=customer-profitability&month=2026-07",
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


  test("completes the incomplete-profitability review → exact Monthly fix → return journey on mobile", async ({ page }) => {
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
          transaction_history_complete: true,
          missing_relevant_period_count: 1,
          incomplete_relevant_period_count: 0,
          estimated_relevant_period_count: 0,
          legacy_manual_allocation_count: 0,
          uses_automatic_allocation: true,
        },
      ]),
    );
    await installIncompleteProfitabilityJourneyRedirects(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/auth/e2e-lifetime-economics?month=2026-07");

    const profitabilityRegion = page.getByRole("region", {
      name: "ربحية العملاء حسب شهر أول شراء — عرض الهاتف",
    });
    await expect(profitabilityRegion).toHaveAttribute("dir", "rtl");
    const incompleteCard = profitabilityRegion.locator("article").filter({ hasText: "غير مكتمل" }).first();
    await expect(incompleteCard).toBeVisible();
    await incompleteCard.getByText("عرض طريقة الحساب").click();
    const reviewJourneyLink = incompleteCard
      .locator("details")
      .getByRole("link", { name: "مراجعة ما ينقص وإكماله" });
    await expect(reviewJourneyLink).toHaveAttribute(
      "href",
      `/businesses/${JOURNEY_BUSINESS_ID}/customers/review?origin=customer-profitability&month=2026-07`,
    );
    await reviewJourneyLink.click();

    await expect(page.getByText("تم تحميل مثال المراجعة بنجاح.")).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("origin")).toBe("customer-profitability");
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2026-07");
    await expect(page.getByRole("link", { name: "العودة إلى ربحية العميل" }).first()).toHaveAttribute(
      "href",
      `/businesses/${JOURNEY_BUSINESS_ID}/customers?view=profitability&month=2026-07`,
    );
    await expectNoHorizontalOverflow(page);

    const coverageException = page
      .locator("article")
      .filter({ hasText: "صافي التحصيل لا يطابق سجل معاملات العملاء" });
    await expect(coverageException).toBeVisible();
    const monthlyFix = coverageException.getByRole("link", { name: "فتح بيانات هذا الشهر" });
    await expect(monthlyFix).toHaveAttribute(
      "href",
      `/businesses/${JOURNEY_BUSINESS_ID}/monthly?month=2026-04&origin=customer-profitability&return_month=2026-07`,
    );
    await monthlyFix.click();

    await expect(page.getByRole("heading", { name: "الإدخال الشهري" })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2026-04");
    await expect.poll(() => new URL(page.url()).searchParams.get("origin")).toBe("customer-profitability");
    await expect.poll(() => new URL(page.url()).searchParams.get("return_month")).toBe("2026-07");
    const returnBanner = page.getByRole("region", { name: "سياق العودة من الإدخال الشهري" });
    await expect(returnBanner).toContainText("بيانات مطلوبة في ربحية العميل");
    const returnToProfitability = returnBanner.getByRole("link", { name: "العودة إلى ربحية العميل" });
    await expect(returnToProfitability).toHaveAttribute(
      "href",
      `/businesses/${JOURNEY_BUSINESS_ID}/customers?view=profitability&month=2026-07`,
    );
    await expectNoHorizontalOverflow(page);

    await returnToProfitability.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2026-07");
    const returnedRegion = page.getByRole("region", {
      name: "ربحية العملاء حسب شهر أول شراء — عرض الهاتف",
    });
    await expect(returnedRegion).toHaveAttribute("dir", "rtl");
    await expect(returnedRegion.getByText("غير مكتمل").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

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