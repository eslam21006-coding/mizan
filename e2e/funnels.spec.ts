import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const liveInviteTokenHash = process.env.MIZAN_E2E_INVITE_TOKEN_HASH?.trim() ?? "";
const hasLiveAuth = Boolean(liveInviteTokenHash || (liveEmail && livePassword));

function funnelCard(page: import("@playwright/test").Page, name: string) {
  return page.locator(`article:has(input[name="name"][value=${JSON.stringify(name)}])`);
}

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

test.describe("Task 14 funnel management", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("creates, edits, deactivates, and renders funnels in Arabic RTL", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `بزنس فانلز ${suffix}`;
    const funnelName = `ويبينار ${suffix}`;
    const updatedName = `فعالية ${suffix}`;

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

    await page.goto("/funnels");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الفانلز", level: 1 })).toBeVisible();
    const overviewBusinessCard = page.locator("article").filter({ hasText: businessName });
    await expect(overviewBusinessCard).toContainText("فانلز اختيارية");
    await overviewBusinessCard.getByRole("link", { name: "إدارة الفانلز" }).click();

    await expect(page.getByRole("heading", { name: "الفانلز", level: 1 })).toBeVisible();
    await expect(page.getByText("اختيارية بالكامل")).toBeVisible();

    await page.getByLabel("اسم الفانل").fill(funnelName);
    await page.getByLabel("نوع الفانل").first().selectOption("webinar");
    await page.getByRole("button", { name: "إضافة الفانل" }).click();

    await expect(page.getByRole("status")).toContainText("تمت إضافة الفانل");
    const createdCard = funnelCard(page, funnelName);
    await expect(createdCard).toHaveCount(1);
    await expect(createdCard).toContainText("Webinar / ويبينار");

    await createdCard.getByLabel("الاسم").fill(updatedName);
    await createdCard.getByLabel("النوع").selectOption("event");
    await createdCard.getByRole("checkbox").uncheck();
    await createdCard.getByRole("button", { name: "حفظ التعديلات" }).click();

    await expect(page.getByRole("status")).toContainText("تم حفظ تعديلات الفانل");
    const updatedCard = funnelCard(page, updatedName);
    await expect(updatedCard).toHaveCount(1);
    await expect(updatedCard).toContainText("Event / فعالية");
    await expect(updatedCard).toContainText("غير نشطة");

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
