import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const liveInviteTokenHash = process.env.MIZAN_E2E_INVITE_TOKEN_HASH?.trim() ?? "";
const hasLiveAuth = Boolean(liveInviteTokenHash || (liveEmail && livePassword));
const requireLiveAuth = process.env.MIZAN_REQUIRE_AUTH_E2E === "true";

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

async function waitForSetupRow(page: import("@playwright/test").Page, name: string) {
  await expect(page.locator(`article input[name="name"][value="${name}"]`)).toBeVisible();
}

test.describe("Task 11 main business dashboard", () => {
  test.beforeAll(() => {
    if (requireLiveAuth && !hasLiveAuth) {
      throw new Error(
        "Authenticated Task 11 E2E is required, but neither an invite token nor email/password credentials were provided.",
      );
    }
  });

  test.skip(
    !hasLiveAuth && !requireLiveAuth,
    "Requires live Mizan Supabase credentials or a one-use invite token",
  );

  test("renders known monthly economics in Arabic RTL and remains usable on mobile", async ({ page }) => {
    test.setTimeout(120_000);

    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `داشبورد ${suffix}`;
    const frontEndName = `Front End ${suffix}`;
    const backendName = `Backend ${suffix}`;
    const adSpendName = `Ad Spend ${suffix}`;
    const deliveryName = `Delivery ${suffix}`;
    const rentName = `Rent ${suffix}`;
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
    await expect(page).toHaveURL(/\/businesses\?status=created$/);

    let businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "إدارة مصادر الإيراد" }).click();

    await page.getByLabel("اسم مصدر الإيراد").fill(frontEndName);
    await page.getByLabel("التصنيف").first().selectOption("front_end");
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
    await waitForSetupRow(page, frontEndName);

    await page.getByLabel("اسم مصدر الإيراد").fill(backendName);
    await page.getByLabel("التصنيف").first().selectOption("backend");
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
    await waitForSetupRow(page, backendName);

    await page.getByRole("link", { name: "العودة للبزنسات" }).click();
    businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "إدارة المصروفات" }).click();

    for (const [name, category, behavior] of [
      [adSpendName, "acquisition", "fixed_monthly"],
      [deliveryName, "fulfillment", "per_customer"],
      [rentName, "overhead", "fixed_monthly"],
      [processorName, "financial", "percentage_revenue"],
    ] as const) {
      await page.getByLabel("اسم المصروف").fill(name);
      await page.getByLabel("التصنيف").first().selectOption(category);
      await page.getByLabel("طريقة التكلفة").first().selectOption(behavior);
      await page.getByRole("button", { name: "إضافة المصروف" }).click();
      await waitForSetupRow(page, name);
    }

    await page.getByRole("link", { name: "العودة للبزنسات" }).click();
    businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "الإدخال الشهري" }).click();

    await page.locator('input[type="month"][name="month"]').fill("2026-04");
    await page.getByRole("button", { name: "فتح الشهر" }).click();
    await page.getByLabel(`الإيراد المحصل — ${frontEndName}`).fill("10000");
    await page.getByLabel(`المرتجعات — ${frontEndName}`).fill("500");
    await page.getByLabel(`الإيراد المحصل — ${backendName}`).fill("4000");
    await page.getByLabel(`المرتجعات — ${backendName}`).fill("0");
    await page.getByLabel("إيراد محصل غير موزع على مصدر").fill("0");
    await page.getByLabel("مرتجعات غير موزعة على مصدر").fill("0");
    await page.getByLabel("عملاء جدد").fill("10");
    await page.getByLabel("إجمالي العملاء الدافعين").fill("15");
    await page.getByLabel(`${adSpendName} — القيمة الشهرية`).fill("2000");
    await page.getByLabel(`${deliveryName} — التكلفة لكل عميل`).fill("20");
    await page
      .getByLabel(`أساس عدد العملاء — ${deliveryName}`)
      .selectOption("total_paying_customers");
    await page.getByLabel(`${rentName} — القيمة الشهرية`).fill("1000");
    await page.getByLabel(`${processorName} — النسبة %`).fill("3.5");
    await page.getByRole("button", { name: "حفظ الشهر" }).click();
    await expect(page.getByRole("status")).toContainText("تم حفظ بيانات الشهر");

    await page.getByRole("link", { name: "العودة للبزنسات" }).click();
    businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "فتح الداشبورد" }).click();
    await page.getByLabel("شهر الداشبورد").fill("2026-04");
    await page.getByRole("button", { name: "فتح الشهر" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "لوحة البزنس", level: 1 })).toBeVisible();
    await expect(page.getByText(businessName, { exact: false }).first()).toBeVisible();

    const marginCard = page
      .locator("article")
      .filter({ has: page.getByText("هامش صافي الربح الحقيقي", { exact: true }) });
    const profitCard = page
      .locator("article")
      .filter({ has: page.getByText("صافي الربح الحقيقي", { exact: true }) });
    const ultimateCacCard = page
      .locator("article")
      .filter({ has: page.getByText("Ultimate CAC", { exact: true }) });
    const netCashCard = page
      .locator("article")
      .filter({ has: page.getByText("صافي الكاش المحصل", { exact: true }) });

    await expect(marginCard).toContainText("٧٢٫١%");
    await expect(profitCard).toContainText("٩٬٧٢٧٫٥ EGP");
    await expect(ultimateCacCard).toContainText("٣٧٧٫٢٥ EGP");
    await expect(netCashCard).toContainText("١٣٬٥٠٠ EGP");
    await expect(page.getByText("التكلفة الكاملة للبزنس لكل عميل جديد", { exact: false })).toBeVisible();
    await expect(page.getByText("ليستا LTV", { exact: false })).toBeVisible();
    await expect(page.getByText("Media CAC و MER و ROAS", { exact: false })).toBeVisible();

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
