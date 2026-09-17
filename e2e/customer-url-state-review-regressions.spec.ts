import { expect, test, type Page, type Route } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-profile, content-type, prefer, range-profile",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "http://127.0.0.1:3000",
  "Access-Control-Expose-Headers": "Content-Range",
};

const cohortRow = {
  business_id: "00000000-0000-4000-8000-000000000063",
  cohort_month: "2026-08-01",
  observation_cutoff_date: "2026-09-10",
  original_cohort_size: "1",
  cumulative_gross_cash_collected_text: "100",
  cumulative_refunds_text: "0",
  cumulative_net_cash_collected_text: "100",
  observed_ltv_text: "100",
  currency: "USD",
};

const customerRow = {
  business_id: "00000000-0000-4000-8000-000000000067",
  customer_email: "buyer@example.com",
  customer_name: "Ahmed Buyer",
  acquisition_at: "2026-09-01T10:00:00+00:00",
  acquisition_date: "2026-09-01",
  transaction_count: 2,
  collection_count: 2,
  refund_count: 1,
  gross_cash_collected_text: "150",
  refunds_text: "25",
  net_cash_collected_text: "125",
  last_transaction_at: "2026-09-07T10:00:00+00:00",
  currency: "EGP",
};

/** Captures browser runtime errors for navigation regression tests. */
function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Returns a successful mocked PostgREST response with the requested total count. */
async function fulfillRows(route: Route, rows: unknown[], totalCount: number) {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
    return;
  }
  const end = rows.length > 0 ? rows.length - 1 : 0;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { ...corsHeaders, "Content-Range": `0-${end}/${totalCount}` },
    body: JSON.stringify(rows),
  });
}

test.describe("Customer URL-state review regressions", () => {
  test("browser Back does not clamp a restored customer page using a stale filtered count", async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);
    await page.route("**/rest/v1/customer_transaction_groups**", async (route) => {
      const url = new URL(route.request().url());
      const isRefundFiltered = url.searchParams.has("refund_count");
      await fulfillRows(route, [customerRow], isRefundFiltered ? 1 : 100);
    });

    await page.goto("/auth/e2e-customer-name-search?view=customers&customerPage=2");
    await expect(page.getByText("الصفحة 2 من 2", { exact: true })).toBeVisible();

    await page.getByLabel("اعرض").selectOption("refunded");
    await expect(page.getByText("الصفحة 1 من 1", { exact: true })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("customerPage")).toBeNull();

    await page.goBack();
    await expect.poll(() => new URL(page.url()).searchParams.get("customerPage")).toBe("2");
    await expect(page.getByText("الصفحة 2 من 2", { exact: true })).toBeVisible();

    expect(browserErrors).toEqual([]);
  });

  test("automatic cohort-page normalization replaces the invalid history entry", async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);
    await page.route("**/rest/v1/customer_observed_ltv**", async (route) => {
      await fulfillRows(route, [cohortRow], 24);
    });

    await page.goto("/auth/e2e-customer-cohort-ux?view=value&marker=before");
    await expect(page.getByText("الصفحة 1 من 2", { exact: true })).toBeVisible();

    await page.goto("/auth/e2e-customer-cohort-ux?view=value&marker=invalid&cohortPage=99");
    await expect.poll(() => new URL(page.url()).searchParams.get("cohortPage")).toBe("2");
    await expect.poll(() => new URL(page.url()).searchParams.get("marker")).toBe("invalid");

    await page.goBack();
    await expect.poll(() => new URL(page.url()).searchParams.get("marker")).toBe("before");
    await expect.poll(() => new URL(page.url()).searchParams.get("cohortPage")).toBeNull();

    expect(browserErrors).toEqual([]);
  });

  test("automatic customer-page normalization also replaces the invalid history entry", async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);
    await page.route("**/rest/v1/customer_transaction_groups**", async (route) => {
      await fulfillRows(route, [customerRow], 100);
    });

    await page.goto("/auth/e2e-customer-name-search?view=customers&marker=before");
    await expect(page.getByText("الصفحة 1 من 2", { exact: true })).toBeVisible();

    await page.goto("/auth/e2e-customer-name-search?view=customers&marker=invalid&customerPage=99");
    await expect.poll(() => new URL(page.url()).searchParams.get("customerPage")).toBe("2");
    await expect.poll(() => new URL(page.url()).searchParams.get("marker")).toBe("invalid");

    await page.goBack();
    await expect.poll(() => new URL(page.url()).searchParams.get("marker")).toBe("before");
    await expect.poll(() => new URL(page.url()).searchParams.get("customerPage")).toBeNull();

    expect(browserErrors).toEqual([]);
  });
});
