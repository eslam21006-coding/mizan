import { expect, test, type Page, type Route } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-profile, content-type, prefer, range-profile",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "http://127.0.0.1:3000",
  "Access-Control-Expose-Headers": "Content-Range",
};

const cohortRows = Array.from({ length: 24 }, (_, index) => {
  const month = String(((7 - index + 1200) % 12) + 1).padStart(2, "0");
  const year = 2026 - Math.floor((index + 4) / 12);
  return {
    business_id: "00000000-0000-4000-8000-000000000063",
    cohort_month: `${year}-${month}-01`,
    observation_cutoff_date: "2026-09-10",
    original_cohort_size: String(index + 1),
    cumulative_gross_cash_collected_text: String((index + 1) * 100),
    cumulative_refunds_text: "0",
    cumulative_net_cash_collected_text: String((index + 1) * 100),
    observed_ltv_text: "100",
    currency: "USD",
  };
});

const customerRows = [
  {
    business_id: "00000000-0000-4000-8000-000000000067",
    customer_email: "buyer@example.com",
    customer_name: "Ahmed Buyer",
    acquisition_at: "2026-09-01T10:00:00+00:00",
    acquisition_date: "2026-09-01",
    transaction_count: 2,
    collection_count: 2,
    refund_count: 0,
    gross_cash_collected_text: "150",
    refunds_text: "0",
    net_cash_collected_text: "150",
    last_transaction_at: "2026-09-07T10:00:00+00:00",
    currency: "EGP",
  },
  {
    business_id: "00000000-0000-4000-8000-000000000067",
    customer_email: "refunded@example.com",
    customer_name: null,
    acquisition_at: "2026-08-01T10:00:00+00:00",
    acquisition_date: "2026-08-01",
    transaction_count: 1,
    collection_count: 1,
    refund_count: 1,
    gross_cash_collected_text: "75",
    refunds_text: "25",
    net_cash_collected_text: "50",
    last_transaction_at: "2026-08-02T10:00:00+00:00",
    currency: "EGP",
  },
];

/** Registers console and page-error collection so URL-state tests also guard browser health. */
function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Serves deterministic two-page Observed LTV data to the real cohort component. */
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

/** Serves deterministic customer rows with a two-page count while leaving query semantics visible in request URLs. */
async function fulfillCustomers(route: Route) {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { ...corsHeaders, "Content-Range": "0-1/100" },
    body: JSON.stringify(customerRows),
  });
}

test.describe("Customer URL-backed analysis state", () => {
  test("N18 preserves cohort pagination through copied URLs, refresh, Back, and unrelated query state", async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);
    await page.route("**/rest/v1/customer_observed_ltv**", fulfillCohorts);

    await page.goto("/auth/e2e-customer-cohort-ux?view=value&keep=1&cohortPage=2");
    await expect(page.getByText("الصفحة 2 من 2", { exact: true })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("value");
    await expect.poll(() => new URL(page.url()).searchParams.get("keep")).toBe("1");
    await expect.poll(() => new URL(page.url()).searchParams.get("cohortPage")).toBe("2");

    await page.reload();
    await expect(page.getByText("الصفحة 2 من 2", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "الصفحة السابقة" }).click();
    await expect(page.getByText("الصفحة 1 من 2", { exact: true })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("cohortPage")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("value");
    await expect.poll(() => new URL(page.url()).searchParams.get("keep")).toBe("1");

    await page.goBack();
    await expect(page.getByText("الصفحة 2 من 2", { exact: true })).toBeVisible();

    await page.goto("/auth/e2e-customer-cohort-ux?view=value&cohortPage=2&cohortPage=3");
    await expect(page.getByText("الصفحة 1 من 2", { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    expect(browserErrors).toEqual([]);
  });

  test("N19 preserves customer search, filter, sort, and page while keeping Customer view state", async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);
    const requests: URL[] = [];
    await page.route("**/rest/v1/customer_transaction_groups**", async (route) => {
      requests.push(new URL(route.request().url()));
      await fulfillCustomers(route);
    });

    await page.goto(
      "/auth/e2e-customer-name-search?view=customers&keep=1&search=buyer%40example.com&filter=repeat&sort=net_cash_desc&customerPage=2",
    );

    const searchInput = page.getByLabel("ابحث بالاسم أو البريد الإلكتروني");
    const filterSelect = page.getByLabel("اعرض");
    const sortSelect = page.getByLabel("رتّب حسب");
    await expect(searchInput).toHaveValue("buyer@example.com");
    await expect(filterSelect).toHaveValue("repeat");
    await expect(sortSelect).toHaveValue("net_cash_desc");
    await expect(page.getByText("الصفحة 2 من 2", { exact: true })).toBeVisible();
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    await expect.poll(() => requests.at(-1)?.searchParams.get("customer_search_text") ?? "").toContain("buyer@example.com");

    await page.reload();
    await expect(searchInput).toHaveValue("buyer@example.com");
    await expect(filterSelect).toHaveValue("repeat");
    await expect(sortSelect).toHaveValue("net_cash_desc");
    await expect(page.getByText("الصفحة 2 من 2", { exact: true })).toBeVisible();

    await filterSelect.selectOption("refunded");
    await expect(page.getByText("الصفحة 1 من 2", { exact: true })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("filter")).toBe("refunded");
    await expect.poll(() => new URL(page.url()).searchParams.get("customerPage")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("customers");
    await expect.poll(() => new URL(page.url()).searchParams.get("keep")).toBe("1");
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("net_cash_desc");

    await page.goBack();
    await expect(filterSelect).toHaveValue("repeat");
    await expect(page.getByText("الصفحة 2 من 2", { exact: true })).toBeVisible();

    await searchInput.fill("Ahmed_50%");
    await page.getByRole("button", { name: "بحث" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe("Ahmed_50%");
    await expect.poll(() => new URL(page.url()).searchParams.get("customerPage")).toBeNull();
    await expect
      .poll(() => requests.at(-1)?.searchParams.get("customer_search_text") ?? "")
      .toContain("Ahmed\\_50\\%");

    await page.getByRole("button", { name: "مسح الفلاتر" }).click();
    await expect(searchInput).toHaveValue("");
    await expect(filterSelect).toHaveValue("all");
    await expect(sortSelect).toHaveValue("acquisition_desc");
    await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("filter")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("customers");
    await expect.poll(() => new URL(page.url()).searchParams.get("keep")).toBe("1");

    await page.goto("/auth/e2e-customer-name-search?filter=repeat&filter=single&sort=unknown&customerPage=zero");
    await expect(filterSelect).toHaveValue("all");
    await expect(sortSelect).toHaveValue("acquisition_desc");
    await expect(page.getByText("الصفحة 1 من 2", { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    expect(browserErrors).toEqual([]);
  });
});
