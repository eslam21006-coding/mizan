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

  test("renders searchable sortable customer facts in Arabic RTL", async ({ page }) => {
    test.setTimeout(120_000);
    const browserErrors: string[] = [];
    const customerGroupRequests: URL[] = [];
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
      customerGroupRequests.push(new URL(route.request().url()));
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
            gross_cash_collected_text: "150",
            refunds_text: "30",
            net_cash_collected_text: "120",
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
            gross_cash_collected_text: "0",
            refunds_text: "5",
            net_cash_collected_text: "-5",
            last_transaction_at: "2026-01-03T10:00:00+00:00",
            currency: "EGP",
          },
        ]),
      });
    });

    await page.goto("/customers");
    const businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "عرض تحليل العملاء" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "العملاء وقيمة العميل" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /متوسط ما دفعه العميل/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: /سجل العملاء/ }).click();
    await expect(page.getByRole("tab", { name: /سجل العملاء/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "من دفع ومتى؟", level: 2 })).toBeVisible();
    await expect(page.getByLabel("ابحث بالبريد الإلكتروني")).toBeVisible();
    await expect(page.getByLabel("اعرض")).toBeVisible();
    await expect(page.getByLabel("رتّب حسب")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "البريد الإلكتروني" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "أول شراء" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "إجمالي التحصيل" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "الاسترجاعات" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "صافي التحصيل" })).toBeVisible();
    await expect(page.getByText("buyer@example.com", { exact: true })).toBeVisible();
    await expect(page.getByText("refund-only@example.com", { exact: true })).toBeVisible();
    await expect(page.getByText("لا يوجد تحصيل ناجح بعد", { exact: true })).toBeVisible();
    await expect(page.getByText("150 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("30 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("120 EGP", { exact: true })).toBeVisible();
    await expect(page.getByText("-5 EGP", { exact: true })).toBeVisible();

    const requestsBeforeFilter = customerGroupRequests.length;
    await page.getByLabel("اعرض").selectOption("repeat");
    await expect.poll(() => customerGroupRequests.length).toBeGreaterThan(requestsBeforeFilter);
    await expect.poll(() => customerGroupRequests.at(-1)?.searchParams.get("collection_count")).toBe("gt.1");

    const requestsBeforeSort = customerGroupRequests.length;
    await page.getByLabel("رتّب حسب").selectOption("net_cash_desc");
    await expect.poll(() => customerGroupRequests.length).toBeGreaterThan(requestsBeforeSort);
    await expect.poll(() => customerGroupRequests.at(-1)?.searchParams.get("order") ?? "").toContain("net_cash_collected.desc");

    await page.getByLabel("ابحث بالبريد الإلكتروني").fill("buyer_50%@example.com");
    const requestsBeforeSearch = customerGroupRequests.length;
    await page.getByRole("button", { name: "بحث" }).click();
    await expect.poll(() => customerGroupRequests.length).toBeGreaterThan(requestsBeforeSearch);
    await expect
      .poll(() => customerGroupRequests.at(-1)?.searchParams.get("customer_email") ?? "")
      .toContain("buyer\\_50\\%@example.com");

    await page.getByRole("button", { name: "مسح الفلاتر" }).click();
    await expect(page.getByLabel("اعرض")).toHaveValue("all");
    await expect(page.getByLabel("رتّب حسب")).toHaveValue("acquisition_desc");
    await expect(page.getByLabel("ابحث بالبريد الإلكتروني")).toHaveValue("");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);

    expect(browserErrors).toEqual([]);
  });
});
