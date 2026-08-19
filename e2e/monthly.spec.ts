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

test.describe("Task 8 monthly data entry", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("saves, edits, copies and revisits three Arabic RTL months", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `بزنس شهري ${suffix}`;
    const frontEndName = `Front End ${suffix}`;
    const backendName = `Backend ${suffix}`;
    const adSpendName = `Ad Spend ${suffix}`;
    const certificateName = `Certificates ${suffix}`;
    const processorName = `Processor ${suffix}`;

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

    let businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "إدارة مصادر الإيراد" }).click();

    await page.getByLabel("اسم مصدر الإيراد").fill(frontEndName);
    await page.getByLabel("التصنيف").first().selectOption("front_end");
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
    await page.getByLabel("اسم مصدر الإيراد").fill(backendName);
    await page.getByLabel("التصنيف").first().selectOption("backend");
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
    await page.getByRole("link", { name: "العودة للبزنسات" }).click();

    businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "إدارة المصروفات" }).click();

    await page.getByLabel("اسم المصروف").fill(adSpendName);
    await page.getByLabel("التصنيف").first().selectOption("acquisition");
    await page.getByLabel("طريقة التكلفة").first().selectOption("fixed_monthly");
    await page.getByRole("button", { name: "إضافة المصروف" }).click();

    await page.getByLabel("اسم المصروف").fill(certificateName);
    await page.getByLabel("التصنيف").first().selectOption("fulfillment");
    await page.getByLabel("طريقة التكلفة").first().selectOption("per_customer");
    await page.getByRole("button", { name: "إضافة المصروف" }).click();

    await page.getByLabel("اسم المصروف").fill(processorName);
    await page.getByLabel("التصنيف").first().selectOption("financial");
    await page.getByLabel("طريقة التكلفة").first().selectOption("percentage_revenue");
    await page.getByRole("button", { name: "إضافة المصروف" }).click();
    await page.getByRole("link", { name: "العودة للبزنسات" }).click();

    businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "الإدخال الشهري" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الإدخال الشهري", level: 1 })).toBeVisible();

    await page.getByLabel("الشهر").fill("2026-01");
    await page.getByRole("button", { name: "فتح الشهر" }).click();
    await page.getByLabel(`الإيراد المحصل — ${frontEndName}`).fill("10000");
    await page.getByLabel(`المرتجعات — ${frontEndName}`).fill("500");
    await page.getByLabel(`الإيراد المحصل — ${backendName}`).fill("4000");
    await page.getByLabel("عملاء جدد").fill("10");
    await page.getByLabel("إجمالي العملاء الدافعين").fill("15");
    await page.getByLabel(`${adSpendName} — القيمة الشهرية`).fill("2000");
    await page.getByLabel(`${certificateName} — التكلفة لكل عميل`).fill("20");
    await page
      .getByLabel(`أساس عدد العملاء — ${certificateName}`)
      .selectOption("total_paying_customers");
    await page.getByLabel(`${processorName} — النسبة %`).fill("3.5");
    await page.getByRole("button", { name: "حفظ الشهر" }).click();
    await expect(page.getByRole("status")).toContainText("تم حفظ بيانات الشهر");

    await page.getByRole("link", { name: "الشهر التالي" }).click();
    await page.getByRole("button", { name: "نسخ مصروفات الشهر السابق" }).click();
    await expect(page.getByRole("status")).toContainText("تم نسخ 3 بند مصروف");
    await expect(page.getByLabel(`${adSpendName} — القيمة الشهرية`)).toHaveValue("2000");
    await expect(page.getByLabel(`${certificateName} — التكلفة لكل عميل`)).toHaveValue("20");
    await expect(page.getByLabel(`${processorName} — النسبة %`)).toHaveValue("3.5");
    await page.getByLabel(`الإيراد المحصل — ${frontEndName}`).fill("0");
    await page.getByLabel(`المرتجعات — ${frontEndName}`).fill("0");
    await page.getByLabel("عملاء جدد").fill("0");
    await page.getByLabel("إجمالي العملاء الدافعين").fill("0");
    await page.getByRole("button", { name: "حفظ الشهر" }).click();

    await page.getByRole("link", { name: "الشهر التالي" }).click();
    await page.getByLabel(`${adSpendName} — القيمة الشهرية`).fill("3000");
    await page
      .getByLabel(`أساس عدد العملاء — ${certificateName}`)
      .selectOption("total_paying_customers");
    await page.getByRole("button", { name: "حفظ الشهر" }).click();
    await page.getByRole("button", { name: "نسخ مصروفات الشهر السابق" }).click();
    await expect(page.getByLabel(`${adSpendName} — القيمة الشهرية`)).toHaveValue("3000");
    await expect(page.getByLabel(`${certificateName} — التكلفة لكل عميل`)).toHaveValue("20");
    await expect(page.getByLabel(`${processorName} — النسبة %`)).toHaveValue("3.5");

    await page.getByLabel("الشهر").fill("2026-01");
    await page.getByRole("button", { name: "فتح الشهر" }).click();
    await expect(page.getByLabel(`الإيراد المحصل — ${frontEndName}`)).toHaveValue("10000");
    await expect(page.getByLabel(`${processorName} — النسبة %`)).toHaveValue("3.5");

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
