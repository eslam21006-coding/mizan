import { expect, test } from "@playwright/test";

test.describe("Customer name-or-email search fixture", () => {
  test("renders the real ledger in Arabic RTL and sends literal name-or-email search filters", async ({ page }) => {
    const browserErrors: string[] = [];
    const customerGroupRequests: URL[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    await page.route("**/rest/v1/customer_transaction_groups**", async (route) => {
      customerGroupRequests.push(new URL(route.request().url()));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Content-Range": "0-1/2" },
        body: JSON.stringify([
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
            customer_email: "unnamed@example.com",
            customer_name: null,
            acquisition_at: "2026-09-02T10:00:00+00:00",
            acquisition_date: "2026-09-02",
            transaction_count: 1,
            collection_count: 1,
            refund_count: 0,
            gross_cash_collected_text: "75",
            refunds_text: "0",
            net_cash_collected_text: "75",
            last_transaction_at: "2026-09-02T10:00:00+00:00",
            currency: "EGP",
          },
        ]),
      });
    });

    await page.goto("/auth/e2e-customer-name-search");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "من دفع ومتى?", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "من دفع ومتى؟", exact: true })).toBeVisible();

    const searchInput = page.getByLabel("ابحث بالاسم أو البريد الإلكتروني");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute("dir", "auto");
    await expect(page.getByText("Ahmed Buyer", { exact: true })).toBeVisible();
    await expect(page.getByText("buyer@example.com", { exact: true })).toBeVisible();
    await expect(page.getByText("unnamed@example.com", { exact: true })).toBeVisible();

    await searchInput.fill("Ahmed_50%");
    const requestsBeforeNameSearch = customerGroupRequests.length;
    await page.getByRole("button", { name: "بحث" }).click();
    await expect.poll(() => customerGroupRequests.length).toBeGreaterThan(requestsBeforeNameSearch);
    await expect
      .poll(() => customerGroupRequests.at(-1)?.searchParams.get("customer_search_text") ?? "")
      .toContain("Ahmed\\_50\\%");

    await searchInput.fill("buyer@example.com");
    const requestsBeforeEmailSearch = customerGroupRequests.length;
    await page.getByRole("button", { name: "بحث" }).click();
    await expect.poll(() => customerGroupRequests.length).toBeGreaterThan(requestsBeforeEmailSearch);
    await expect
      .poll(() => customerGroupRequests.at(-1)?.searchParams.get("customer_search_text") ?? "")
      .toContain("buyer@example.com");

    await page.getByRole("button", { name: "مسح الفلاتر" }).click();
    await expect(searchInput).toHaveValue("");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);

    expect(browserErrors).toEqual([]);
  });
});
