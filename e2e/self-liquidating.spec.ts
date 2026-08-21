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

async function createRevenueStream(
  page: import("@playwright/test").Page,
  name: string,
  type: "front_end" | "backend" | "other",
) {
  await page.getByLabel("اسم مصدر الإيراد").fill(name);
  await page.getByLabel("التصنيف").first().selectOption(type);
  await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
  await expect(page.locator(`article input[name="name"][value=${JSON.stringify(name)}]`)).toBeVisible();
}

test.describe("Task 16 self-liquidating funnel engine", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("calculates exact Front-End liquidation without counting Backend or Other revenue", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `تسييل ${suffix}`;
    const frontEndName = `Front Offer ${suffix}`;
    const backendName = `Backend Offer ${suffix}`;
    const otherName = `Other Income ${suffix}`;
    const variableExpenseName = `Certificates ${suffix}`;
    const funnelName = `Webinar ${suffix}`;

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
    await createRevenueStream(page, frontEndName, "front_end");
    await createRevenueStream(page, backendName, "backend");
    await createRevenueStream(page, otherName, "other");

    await page.getByRole("link", { name: "العودة للبزنسات" }).click();
    businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "إدارة المصروفات" }).click();
    await page.getByLabel("اسم المصروف").fill(variableExpenseName);
    await page.getByLabel("التصنيف").first().selectOption("fulfillment");
    await page.getByLabel("طريقة التكلفة").first().selectOption("per_customer");
    await page.getByRole("button", { name: "إضافة المصروف" }).click();
    await expect(
      page.locator(`article input[name="name"][value=${JSON.stringify(variableExpenseName)}]`),
    ).toBeVisible();

    await page.getByRole("link", { name: "العودة للبزنسات" }).click();
    businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "إدارة الفانلز" }).click();
    await page.getByLabel("اسم الفانل").fill(funnelName);
    await page.getByLabel("نوع الفانل").first().selectOption("webinar");
    await page.getByRole("button", { name: "إضافة الفانل" }).click();
    await expect(page.getByRole("status")).toContainText("تمت إضافة الفانل");

    const businessIdMatch = /\/businesses\/([^/]+)\/funnels/.exec(new URL(page.url()).pathname);
    expect(businessIdMatch?.[1]).toBeTruthy();
    const businessId = businessIdMatch?.[1] ?? "";

    await page.goto(`/businesses/${businessId}/funnels/monthly?month=2026-05`);
    await page.getByLabel("إجمالي الإنفاق الإعلاني للبزنس — EGP").fill("1500");
    await page.getByLabel(`Ad Spend — ${funnelName}`).fill("1500");
    await page.getByRole("button", { name: "حفظ أرقام الفانلز" }).click();
    await expect(page.getByRole("status")).toContainText("تم حفظ أرقام الفانلز");

    await page.goto(`/businesses/${businessId}/monthly?month=2026-05`);
    await page.getByLabel(`الإيراد المحصل — ${frontEndName}`).fill("2000");
    await page.getByLabel(`المرتجعات — ${frontEndName}`).fill("100");
    await page.getByLabel(`الإيراد المحصل — ${backendName}`).fill("500");
    await page.getByLabel(`المرتجعات — ${backendName}`).fill("0");
    await page.getByLabel(`الإيراد المحصل — ${otherName}`).fill("300");
    await page.getByLabel(`المرتجعات — ${otherName}`).fill("0");
    await page.getByLabel("عملاء جدد").fill("10");
    await page.getByLabel("إجمالي العملاء الدافعين").fill("20");
    await page.getByLabel(`${variableExpenseName} — التكلفة لكل عميل`).fill("20");
    await page
      .getByLabel(`أساس عدد العملاء — ${variableExpenseName}`)
      .selectOption("new_customers");

    const otherRevenueRow = page.locator("div").filter({ hasText: otherName }).filter({ hasText: "Other" });
    await expect(otherRevenueRow.first()).toBeVisible();

    await page.getByRole("button", { name: "حفظ الشهر" }).click();
    await expect(page.getByRole("status")).toContainText("تم حفظ بيانات الشهر");

    await page.goto(`/businesses/${businessId}/liquidation?month=2026-05`);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "تسييل الإنفاق الإعلاني", level: 1 }),
    ).toBeVisible();

    const frontEndNetCashCard = page
      .locator("article")
      .filter({ has: page.getByText("Front-End Net Cash", { exact: true }) });
    const variableCostCard = page
      .locator("article")
      .filter({ has: page.getByText("Front-End Variable Costs", { exact: true }) });
    await expect(frontEndNetCashCard).toContainText("١٬٩٠٠ EGP");
    await expect(variableCostCard).toContainText("توزيع التكاليف المتغيرة غير مكتمل");

    await page.getByLabel(`المخصص للـ Front-End — ${variableExpenseName}`).fill("100");
    await page.getByRole("button", { name: "حفظ توزيعات Front-End" }).click();
    await expect(page.getByRole("status")).toContainText("تم حفظ توزيعات تكاليف الـ Front-End");

    const contributionCard = page
      .locator("article")
      .filter({ has: page.getByText("Front-End Contribution Profit", { exact: true }) });
    const liquidationCard = page
      .locator("article")
      .filter({ has: page.getByText("Ad Liquidation Rate", { exact: true }) });
    const remainingAdCostCard = page
      .locator("article")
      .filter({ has: page.getByText("Effective Remaining Ad Cost", { exact: true }) });
    const canonicalAdSpendCard = page
      .locator("article")
      .filter({ has: page.getByText("Canonical Total Ad Spend", { exact: true }) });

    await expect(variableCostCard).toContainText("١٠٠ EGP");
    await expect(contributionCard).toContainText("١٬٨٠٠ EGP");
    await expect(liquidationCard).toContainText("١٢٠%");
    await expect(remainingAdCostCard).toContainText("-٣٠٠ EGP");
    await expect(canonicalAdSpendCard).toContainText("١٬٥٠٠ EGP");

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
