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

test.describe("Task 15 funnel monthly metrics", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("calculates funnel metrics, reconciles ad spend, and feeds Media CAC/MER", async ({ page }) => {
    test.setTimeout(180_000);

    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `فانل شهري ${suffix}`;
    const funnelName = `ويبينار شهري ${suffix}`;

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

    const businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "إدارة الفانلز" }).click();
    await page.getByLabel("اسم الفانل").fill(funnelName);
    await page.getByLabel("نوع الفانل").first().selectOption("webinar");
    await page.getByRole("button", { name: "إضافة الفانل" }).click();
    await expect(page.getByRole("status")).toContainText("تمت إضافة الفانل");

    const businessIdMatch = /\/businesses\/([^/]+)\/funnels/.exec(new URL(page.url()).pathname);
    expect(businessIdMatch?.[1]).toBeTruthy();
    const businessId = businessIdMatch?.[1] ?? "";

    await page.goto(`/businesses/${businessId}/funnels/monthly?month=2026-05`);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { name: "أرقام الفانلز الشهرية", level: 1 }),
    ).toBeVisible();

    await page.getByLabel("إجمالي الإنفاق الإعلاني للبزنس — EGP").fill("1200");
    await page.getByLabel("Ad Spend").fill("1000");
    await page.getByLabel("Leads").fill("100");
    await page.getByLabel("Booked Calls").fill("20");
    await page.getByLabel("Showed Calls").fill("13");
    await page.getByLabel("Qualified Calls").fill("10");
    await page.getByLabel("Sales").fill("2");
    await page.getByLabel("New Customers").fill("2");
    await page.getByLabel("Cash Collected — EGP").fill("5000");
    await page.getByRole("button", { name: "حفظ أرقام الفانلز" }).click();

    await expect(page.getByRole("status")).toContainText("تم حفظ أرقام الفانلز");
    await expect(page.getByRole("heading", { name: "يوجد فرق يحتاج مراجعة" })).toBeVisible();
    await expect(page.getByText("Show Rate: أقل من الحد الصحي")).toBeVisible();
    await expect(page.getByText("Close Rate: أقل من الحد الصحي")).toBeVisible();

    const roasMetric = page.locator("div").filter({ hasText: /^ROAS/ }).last();
    await expect(roasMetric).toContainText("الإسناد غير متاح");

    await page.getByLabel("إجمالي الإنفاق الإعلاني للبزنس — EGP").fill("1000");
    await page.getByLabel("Showed Calls").fill("14");
    await page.getByLabel("Sales").fill("3");
    await page.getByLabel("Attributed Revenue — EGP").fill("2000");
    await page.getByRole("button", { name: "حفظ أرقام الفانلز" }).click();

    await expect(page.getByRole("status")).toContainText("تم حفظ أرقام الفانلز");
    await expect(page.getByText("إجمالي إنفاق البزنس يطابق مجموع إنفاق الفانلز")).toBeVisible();
    await expect(page.getByText("Show Rate: صحي")).toBeVisible();
    await expect(page.getByText("Close Rate: صحي")).toBeVisible();

    const funnelCard = page.locator("article").filter({ hasText: funnelName });
    await expect(funnelCard).toContainText("CPL");
    await expect(funnelCard).toContainText("١٠ EGP");
    await expect(funnelCard).toContainText("ROAS");
    await expect(funnelCard).toContainText("٢×");

    await page.goto(`/businesses/${businessId}/monthly?month=2026-05`);
    await page.getByLabel("إيراد محصل غير موزع على مصدر").fill("5000");
    await page.getByLabel("مرتجعات غير موزعة على مصدر").fill("0");
    await page.getByLabel("عملاء جدد").fill("2");
    await page.getByLabel("إجمالي العملاء الدافعين").fill("2");
    await page.getByRole("button", { name: "حفظ الشهر" }).click();
    await expect(page.getByRole("status")).toContainText("تم حفظ بيانات الشهر");

    await page.goto(`/?business=${businessId}&month=2026-05`);
    const mediaCacCard = page
      .locator("article")
      .filter({ has: page.getByText("Media CAC", { exact: true }) });
    const merCard = page
      .locator("article")
      .filter({ has: page.getByText("MER", { exact: true }) });
    await expect(mediaCacCard).toContainText("٥٠٠ EGP");
    await expect(merCard).toContainText("٥×");

    await page.goto(`/businesses/${businessId}/funnels/monthly?month=2026-05`);
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
