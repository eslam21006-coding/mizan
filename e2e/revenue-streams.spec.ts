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

test.describe("Task 6 revenue stream management", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("creates, edits, deactivates, and renders revenue streams in Arabic RTL", async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `بزنس مصادر ${suffix}`;
    const streamName = `العرض الأمامي ${suffix}`;
    const updatedName = `الترقية ${suffix}`;

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

    const businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "إدارة مصادر الإيراد" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "مصادر الإيراد", level: 1 })).toBeVisible();

    await page.getByLabel("اسم مصدر الإيراد").fill(streamName);
    await page.getByLabel("التصنيف").first().selectOption("front_end");
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();

    await expect(page.getByRole("status")).toContainText("تمت إضافة مصدر الإيراد");
    const streamCard = page
      .locator("article")
      .filter({ has: page.getByDisplayValue(streamName, { exact: true }) });
    await expect(streamCard).toHaveCount(1);
    await expect(streamCard).toContainText("Front-End / أمامي");

    await streamCard.getByLabel("الاسم").fill(updatedName);
    await streamCard.getByLabel("التصنيف").selectOption("backend");
    await streamCard.getByRole("checkbox").uncheck();
    await streamCard.getByRole("button", { name: "حفظ التعديلات" }).click();

    await expect(page.getByRole("status")).toContainText("تم حفظ تعديلات مصدر الإيراد");
    const updatedCard = page
      .locator("article")
      .filter({ has: page.getByDisplayValue(updatedName, { exact: true }) });
    await expect(updatedCard).toHaveCount(1);
    await expect(updatedCard).toContainText("Backend / خلفي");
    await expect(updatedCard).toContainText("غير نشط");

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
