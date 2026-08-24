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

test.describe("Task 20 transaction duplicate protection", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("shows skipped duplicates and keeps repeated imports explicit", async ({ page }) => {
    test.setTimeout(150_000);

    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `Duplicate معاملات ${suffix}`;

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

    await page.goto("/customers");
    const businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "معاينة CSV / XLSX" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const csv = [
      "Customer Email,Transaction Date,Amount Collected,Transaction ID",
      "buyer@example.com,2026-08-24,100,txn_1",
      "buyer@example.com,2026-08-24,100,txn_1",
      "second@example.com,2026-08-24,200,txn_2",
    ].join("\n");

    await page.getByLabel("CSV أو XLSX").setInputFiles({
      name: "stripe-export.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });

    await page.getByLabel("Customer Email").selectOption("0");
    await page.getByLabel("Transaction Date").selectOption("1");
    await page.getByLabel("Amount Collected").selectOption("2");
    await page.getByLabel(/Transaction ID/).selectOption("3");
    await page.getByRole("checkbox", { name: /أول صف غير فارغ يحتوي على عناوين الأعمدة/ }).check();
    await page.getByRole("button", { name: "تشغيل Validation" }).click();
    await expect(page.getByText("Validation ناجح", { exact: true })).toBeVisible();

    let rpcCalls = 0;
    await page.route("**/rest/v1/rpc/import_customer_transactions", async (route) => {
      rpcCalls += 1;
      const response = rpcCalls === 1
        ? { inserted_count: 2, duplicate_count: 1 }
        : { inserted_count: 0, duplicate_count: 3 };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    });

    await page.getByLabel("مصدر المعاملات").fill("Stripe");
    await page.getByRole("button", { name: "استيراد المعاملات" }).click();
    await expect(page.getByText("تمت إضافتها", { exact: true }).locator("xpath=following-sibling::strong[1]")).toHaveText("2");
    await expect(page.getByText("مكررة تم تخطيها", { exact: true }).locator("xpath=following-sibling::strong[1]")).toHaveText("1");

    await page.getByRole("button", { name: "استيراد المعاملات" }).click();
    await expect(page.getByText("تمت إضافتها", { exact: true }).locator("xpath=following-sibling::strong[1]")).toHaveText("0");
    await expect(page.getByText("مكررة تم تخطيها", { exact: true }).locator("xpath=following-sibling::strong[1]")).toHaveText("3");
    await expect(page.getByText(/لم تتم مضاعفة أي معاملات/)).toBeVisible();
    expect(rpcCalls).toBe(2);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);

    expect(browserErrors).toEqual([]);
  });
});
