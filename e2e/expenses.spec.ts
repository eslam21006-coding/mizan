import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const liveInviteTokenHash = process.env.MIZAN_E2E_INVITE_TOKEN_HASH?.trim() ?? "";
const hasLiveAuth = Boolean(liveInviteTokenHash || (liveEmail && livePassword));

function expenseCard(page: import("@playwright/test").Page, name: string) {
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

test.describe("Task 7 expense structure", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("creates, edits, deactivates, and renders expense structure in Arabic RTL", async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `بزنس مصروفات ${suffix}`;
    const expenseName = `إعلانات Meta ${suffix}`;
    const updatedName = `رسوم بوابة الدفع ${suffix}`;

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
    await businessCard.getByRole("link", { name: "إدارة المصروفات" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "هيكل المصروفات", level: 1 })).toBeVisible();

    await page.getByLabel("اسم المصروف").fill(expenseName);
    await page.getByLabel("التصنيف").first().selectOption("acquisition");
    await page.getByLabel("طريقة التكلفة").first().selectOption("fixed_monthly");
    await page.getByRole("button", { name: "إضافة المصروف" }).click();

    await expect(page.getByRole("status")).toContainText("تمت إضافة بند المصروف");
    const createdCard = expenseCard(page, expenseName);
    await expect(createdCard).toHaveCount(1);
    await expect(createdCard).toContainText("اكتساب العملاء");
    await expect(createdCard).toContainText("ثابت شهريًا");
    await expect(createdCard).toContainText("تكلفة ثابتة");

    await createdCard.getByLabel("الاسم").fill(updatedName);
    await createdCard.getByLabel("التصنيف").selectOption("financial");
    await createdCard.getByLabel("طريقة التكلفة").selectOption("percentage_revenue");
    await createdCard.getByRole("checkbox").uncheck();
    await createdCard.getByRole("button", { name: "حفظ التعديلات" }).click();

    await expect(page.getByRole("status")).toContainText("تم حفظ تعديلات بند المصروف");
    const updatedCard = expenseCard(page, updatedName);
    await expect(updatedCard).toHaveCount(1);
    await expect(updatedCard).toContainText("المصاريف المالية");
    await expect(updatedCard).toContainText("نسبة من الإيراد");
    await expect(updatedCard).toContainText("تكلفة متغيرة");
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
