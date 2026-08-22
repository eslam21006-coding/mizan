import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const liveInviteTokenHash = process.env.MIZAN_E2E_INVITE_TOKEN_HASH?.trim() ?? "";
const hasLiveAuth = Boolean(liveInviteTokenHash || (liveEmail && livePassword));

async function login(page: import("@playwright/test").Page) {
  if (liveInviteTokenHash) {
    await page.goto(
      `/auth/confirm?token_hash=${encodeURIComponent(liveInviteTokenHash)}&type=invite`,
    );
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

test.describe("Task 17 CSV/XLSX upload and preview", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("previews a payment CSV locally without importing transactions", async ({ page }) => {
    test.setTimeout(150_000);

    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `معاينة معاملات ${suffix}`;

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
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "العملاء و LTV", level: 1 })).toBeVisible();

    const businessCard = page.locator("article").filter({ hasText: businessName });
    await expect(businessCard).toBeVisible();
    await businessCard.getByRole("link", { name: "معاينة CSV / XLSX" }).click();
    await expect(page).toHaveURL(/\/businesses\/[^/]+\/customers\/import$/);
    await expect(
      page.getByRole("heading", { name: "معاينة ملف معاملات العملاء", level: 1 }),
    ).toBeVisible();

    const csv = [
      "Customer Email,Transaction Date,Amount Collected,Status",
      'buyer@example.com,2026-05-01,120.50,"paid, settled"',
      "second@example.com,2026-05-02,75,paid",
    ].join("\n");

    await page.getByLabel("CSV أو XLSX").setInputFiles({
      name: "gateway-export.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });

    await expect(page.getByRole("heading", { name: "معاينة الملف", level: 2 })).toBeVisible();
    await expect(page.getByText("gateway-export.csv", { exact: true })).toBeVisible();

    const rowsTerm = page.getByText("الصفوف المحللة", { exact: true });
    await expect(rowsTerm.locator("xpath=following-sibling::dd[1]")).toHaveText("3");
    const columnsTerm = page.getByText("الأعمدة المكتشفة", { exact: true });
    await expect(columnsTerm.locator("xpath=following-sibling::dd[1]")).toHaveText("4");

    await expect(page.getByRole("table", { name: "جدول معاينة ملف المعاملات" })).toContainText(
      "buyer@example.com",
    );
    await expect(page.getByRole("table", { name: "جدول معاينة ملف المعاملات" })).toContainText(
      "paid, settled",
    );
    await expect(page.getByRole("button", { name: "استيراد المعاملات" })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      )
      .toBe(true);

    expect(browserErrors).toEqual([]);
  });
});
