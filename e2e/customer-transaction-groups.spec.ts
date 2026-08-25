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

test.describe("Task 21 customer identity and transaction grouping", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("renders grouped customer facts in Arabic RTL without calling them LTV", async ({ page }) => {
    test.setTimeout(120_000);
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `Customer Groups ${suffix}`;

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

    await page.route("**/rest/v1/customer_transaction_groups**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Content-Range": "0-1/2" },
        body: JSON.stringify([
          {
            business_id: "browser-business",
            customer_email: "buyer@example.com",
            acquisition_at: "2026-01-02T10:00:00+00:00",
            acquisition_date: "2026-01-02",
            transaction_count: 4,
            collection_count: 2,
            refund_count: 2,
            gross_cash_collected: "150",
            refunds: "30",
            net_cash_collected: "120",
            last_transaction_at: "2026-01-06T10:00:00+00:00",
            currency: "EGP",
          },
          {
            business_id: "browser-business",
            customer_email: "refund-only@example.com",
            acquisition_at: null,
            acquisition_date: null,
            transaction_count: 1,
            collection_count: 0,
            refund_count: 1,
            gross_cash_collected: "0",
            refunds: "5",
            net_cash_collected: "-5",
            last_transaction_at: "2026-01-03T10:00:00+00:00",
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
    await expect(page.getByText("buyer@example.com", { exact: true })).toBeVisible();
    await expect(page.getByText("refund-only@example.com", { exact: true })).toBeVisible();
    await expect(page.getByText("لم يتم اكتساب العميل بعد", { exact: true })).toBeVisible();
    await expect(page.getByText("150 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("30 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("120 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("-5 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText(/الأرقام أدناه حقائق من سجل المعاملات وليست LTV/)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);

    expect(browserErrors).toEqual([]);
  });
});
