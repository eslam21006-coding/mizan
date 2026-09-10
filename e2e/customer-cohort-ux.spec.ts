import { expect, test, type Route } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-profile, content-type, prefer, range-profile",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "http://127.0.0.1:3000",
  "Access-Control-Expose-Headers": "Content-Range",
};

const cohortRows = Array.from({ length: 24 }, (_, index) => {
  const absoluteMonth = 2026 * 12 + 7 - index;
  const year = Math.floor(absoluteMonth / 12);
  const month = (absoluteMonth % 12) + 1;
  const monthText = String(month).padStart(2, "0");

  if (index === 0) {
    return {
      business_id: "mock-business",
      cohort_month: "2026-08-01",
      observation_month: "2026-09-01",
      observation_cutoff_date: "2026-09-10",
      original_cohort_size: "45",
      cumulative_gross_cash_collected_text: "6829",
      cumulative_refunds_text: "0",
      cumulative_net_cash_collected_text: "6829",
      observed_ltv_text: "151.755555555555556",
      cohort_age_months: 1,
      months_observed: 2,
      currency: "USD",
    };
  }

  if (index === 1) {
    return {
      business_id: "mock-business",
      cohort_month: "2026-07-01",
      observation_month: "2026-09-01",
      observation_cutoff_date: "2026-09-10",
      original_cohort_size: "1",
      cumulative_gross_cash_collected_text: "3500",
      cumulative_refunds_text: "0",
      cumulative_net_cash_collected_text: "3500",
      observed_ltv_text: "3500",
      cohort_age_months: 2,
      months_observed: 3,
      currency: "USD",
    };
  }

  return {
    business_id: "mock-business",
    cohort_month: `${year}-${monthText}-01`,
    observation_month: "2026-09-01",
    observation_cutoff_date: "2026-09-10",
    original_cohort_size: String(index + 1),
    cumulative_gross_cash_collected_text: String((index + 1) * 1000),
    cumulative_refunds_text: String(index),
    cumulative_net_cash_collected_text: String((index + 1) * 1000 - index),
    observed_ltv_text: String(100 + index / 3),
    cohort_age_months: index + 1,
    months_observed: index + 2,
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
  test("shows cumulative customer value in four clear columns without redundant month-age labels", async ({ page }) => {
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
    await expect(page.getByText(/كل صف يمثل العملاء الذين كانت أول دفعة لهم في الشهر الموضح/)).toBeVisible();
    await expect(page.getByText(/وليس ما دفعوه داخل شهر البداية فقط/)).toBeVisible();
    await expect(page.getByText(/البيانات محسوبة حتى/)).toHaveCount(1);

    const table = page.getByRole("table", { name: "قيمة العميل حسب شهر أول شراء" });
    await expect(table.getByRole("columnheader")).toHaveCount(4);
    await expect(table.getByRole("columnheader", { name: "شهر أول شراء" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "العملاء الذين بدأوا في هذا الشهر" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "إجمالي ما دفعوه حتى الآن" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "متوسط ما دفعه العميل حتى الآن" })).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(12);

    const augustRow = table.getByRole("row").filter({ hasText: "أغسطس" });
    await expect(augustRow).toBeVisible();
    await expect(augustRow.getByText("45", { exact: true })).toBeVisible();
    await expect(augustRow.getByText("6,829 USD", { exact: true }).first()).toBeVisible();
    await expect(augustRow.getByText("151.76 USD", { exact: true })).toBeVisible();
    await expect(augustRow.getByText(/صافي التحصيل من أول شراء حتى تاريخ الحساب/)).toBeVisible();

    const julyRow = table.getByRole("row").filter({ hasText: "يوليو" });
    await expect(julyRow.getByText("1", { exact: true })).toBeVisible();
    await expect(julyRow.getByText("3,500 USD", { exact: true }).first()).toBeVisible();
    await expect(julyRow.getByText("3,500 USD", { exact: true }).last()).toBeVisible();

    await expect(page.getByText("مرّ منذ أول شراء", { exact: true })).toHaveCount(0);
    await expect(page.getByText("بعد شهر", { exact: true })).toHaveCount(0);
    await expect(page.getByText("بعد شهرين", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/بعد 3 أشهر/)).toHaveCount(0);
    await expect(page.getByText(/كوهورت/)).toHaveCount(0);
    await expect(page.getByText("2026-09-10", { exact: true })).toHaveCount(0);
    await expect(page.getByText("الصفحة 1 من 2", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "الصفحة التالية" }).click();
    await expect(page.getByText("الصفحة 2 من 2", { exact: true })).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(12);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileList = page.getByRole("region", { name: "قيمة العميل حسب شهر أول شراء — عرض الهاتف" });
    await expect(mobileList).toBeVisible();
    await expect(table).toBeHidden();
    await expect(mobileList.getByText("إجمالي ما دفعوه حتى الآن", { exact: true }).first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    expect(browserErrors).toEqual([]);
  });
});
