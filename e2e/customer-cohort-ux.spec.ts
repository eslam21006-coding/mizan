import { expect, test, type Route } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-profile, content-type, prefer, range-profile",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "http://127.0.0.1:3000",
  "Access-Control-Expose-Headers": "Content-Range",
};

const cohortRows = Array.from({ length: 24 }, (_, index) => {
  const absoluteMonth = 2026 * 12 + 11 - index;
  const year = Math.floor(absoluteMonth / 12);
  const month = (absoluteMonth % 12) + 1;
  const monthText = String(month).padStart(2, "0");
  return {
    business_id: "mock-business",
    cohort_month: `${year}-${monthText}-01`,
    observation_month: "2026-12-01",
    observation_cutoff_date: "2026-12-31",
    original_cohort_size: index === 0 ? "1260" : String(index + 1),
    cumulative_gross_cash_collected_text: index === 0 ? "321575.88" : String((index + 1) * 1000),
    cumulative_refunds_text: index === 0 ? "0" : String(index),
    cumulative_net_cash_collected_text: index === 0 ? "321575.88" : String((index + 1) * 1000 - index),
    observed_ltv_text: index === 0 ? "255.218952380952381" : String(100 + index / 3),
    cohort_age_months: index === 0 ? 1 : index,
    months_observed: index + 1,
    currency: "USD",
  };
});

/** Serves deterministic paginated first-purchase groups to the browser fixture, including CORS preflight handling. */
async function fulfillCohorts(route: Route) {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
    return;
  }

  const url = new URL(route.request().url());
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? "12");
  const slice = cohortRows.slice(offset, offset + limit);
  const end = slice.length > 0 ? offset + slice.length - 1 : offset;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { ...corsHeaders, "Content-Range": `${offset}-${end}/${cohortRows.length}` },
    body: JSON.stringify(slice),
  });
}

test.describe("Customer first-purchase-group UX", () => {
  test("shows one year per page with readable amounts and plain age labels", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.route("**/rest/v1/customer_observed_ltv**", fulfillCohorts);
    await page.goto("/auth/e2e-customer-cohort-ux");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "كم دفع عملاء كل شهر حتى الآن؟" })).toBeVisible();
    await expect(page.getByText(/نقسم العملاء حسب شهر أول شراء فقط للمقارنة/)).toBeVisible();

    const table = page.getByRole("table", { name: "قيمة العميل حسب شهر أول شراء" });
    await expect(table.getByRole("columnheader")).toHaveCount(5);
    await expect(table.locator("tbody tr")).toHaveCount(12);
    await expect(table.getByText("1,260", { exact: true })).toBeVisible();
    await expect(table.getByText("321,575.88 USD", { exact: true }).first()).toBeVisible();
    await expect(table.getByText("255.22 USD", { exact: true })).toBeVisible();
    await expect(table.getByText("بعد شهر", { exact: true }).first()).toBeVisible();
    await expect(table.getByText(/^M1$/)).toHaveCount(0);
    await expect(page.getByText("الصفحة 1 من 2", { exact: true })).toBeVisible();
    await expect(page.getByText(/كوهورت/)).toHaveCount(0);

    await page.getByRole("button", { name: "الصفحة التالية" }).click();
    await expect(page.getByText("الصفحة 2 من 2", { exact: true })).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(12);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    expect(browserErrors).toEqual([]);
  });
});
