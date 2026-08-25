import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const liveInviteTokenHash = process.env.MIZAN_E2E_INVITE_TOKEN_HASH?.trim() ?? "";
const hasLiveAuth = Boolean(liveInviteTokenHash || (liveEmail && livePassword));

async function login(page: import("@playwright/test").Page) {
  if (liveInviteTokenHash) {
    await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(liveInviteTokenHash)}&type=invite`);
    await expect(page).toHaveURL(/\/set-password$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    return;
  }

  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(liveEmail);
  await page.getByLabel("كلمة المرور").fill(livePassword);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("Tasks 22-23 cohorts and Observed LTV", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("renders realized cohort value and maturity in Arabic RTL", async ({ page }) => {
    test.setTimeout(120_000);
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `Observed LTV ${suffix}`;

    await login(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/businesses/new");
    await page.getByLabel("اسم البزنس").fill(businessName);
    await page.getByLabel("اسم البزنس").press("Enter");
    await page.getByRole("button", { name: /EGP/ }).click();
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByLabel("المنطقة الزمنية").selectOption("Africa/Cairo");
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByRole("button", { name: "إنشاء البزنس" }).click();
    await expect(page).toHaveURL(/\/businesses\?status=created$/);

    await page.route("**/rest/v1/customer_observed_ltv**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Content-Range": "0-0/1" },
        body: JSON.stringify([
          {
            business_id: "browser-business",
            cohort_month: "2026-01-01",
            observation_month: "2026-03-01",
            observation_cutoff_date: "2026-03-31",
            original_cohort_size: 4,
            cumulative_gross_cash_collected_text: "500",
            cumulative_refunds_text: "80",
            cumulative_net_cash_collected_text: "420",
            observed_ltv_text: "105",
            cohort_age_months: 2,
            months_observed: 3,
            currency: "EGP",
          },
        ]),
      });
    });

    await page.route("**/rest/v1/customer_transaction_groups**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Content-Range": "0-0/1" },
        body: JSON.stringify([
          {
            business_id: "browser-business",
            customer_email: "c1@example.com",
            acquisition_at: "2026-01-01T10:00:00+00:00",
            acquisition_date: "2026-01-01",
            transaction_count: 2,
            collection_count: 2,
            refund_count: 0,
            gross_cash_collected_text: "200",
            refunds_text: "0",
            net_cash_collected_text: "200",
            last_transaction_at: "2026-02-05T10:00:00+00:00",
            currency: "EGP",
          },
        ]),
      });
    });

    await page.goto("/customers");
    const businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "تجميع العملاء" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: `عملاء ${businessName}` })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Observed LTV / قيمة العميل المحققة حتى الآن" }),
    ).toBeVisible();
    await expect(page.getByText("2026-01-01", { exact: true })).toBeVisible();
    await expect(page.getByText("500 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("80 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("420 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("105 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("M2", { exact: true })).toBeVisible();
    await expect(page.getByText("3 شهرًا مُلاحظًا", { exact: true })).toBeVisible();
    await expect(page.getByText("2026-03-31", { exact: true })).toBeVisible();
    await expect(page.getByText(/ليست توقعًا للقيمة النهائية/)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);

    expect(browserErrors).toEqual([]);
  });
});
