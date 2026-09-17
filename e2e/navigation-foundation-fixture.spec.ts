import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-navigation-foundation";
const expectedProfitabilityReturn =
  "/businesses/business%20fixture%2F01/customers?view=profitability&month=2026-08";

/** Collects console and uncaught page errors so each fixture test can fail on browser noise. */
function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("CI-only navigation foundation fixture", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("renders RTL hierarchy, stable actions, safe Return context, and an in-page error", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const breadcrumb = page.getByRole("navigation", { name: "مسار التنقل" });
    const businessesLink = breadcrumb.getByRole("link", { name: "البزنسات" });
    const businessLink = breadcrumb.getByRole("link", { name: "أكاديمية ميزان" });
    const currentCrumb = breadcrumb.getByText("اقتصاديات العملاء", { exact: true });
    const backLink = page.getByRole("link", { name: "العودة إلى البزنس" });
    const expectedBusinessDashboard = "/?business=business+fixture%2F01";

    await expect(businessesLink).toHaveAttribute("href", "/businesses");
    await expect(businessLink).toHaveAttribute("href", expectedBusinessDashboard);
    await expect(currentCrumb).toHaveAttribute("aria-current", "page");
    await expect(backLink).toHaveAttribute("href", expectedBusinessDashboard);

    await businessesLink.focus();
    await expect(businessesLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(businessLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(backLink).toBeFocused();

    const context = page.getByRole("region", { name: "سياق البزنس" });
    await expect(context.getByText("أكاديمية ميزان", { exact: true })).toBeVisible();
    await expect(context.locator('bdi[dir="ltr"]')).toHaveText(["SAR", "Asia/Riyadh"]);

    const normalActions = page.getByRole("group", { name: "إجراءات الصفحة", exact: true });
    const safeReturnLink = normalActions.getByRole("link", { name: "عودة آمنة لربحية العميل" });
    await expect(normalActions).toHaveAttribute("data-action-state", "normal");
    await expect(safeReturnLink).toHaveAttribute("href", expectedProfitabilityReturn);
    await safeReturnLink.focus();
    await expect(safeReturnLink).toBeFocused();

    const returnBanner = page.getByRole("region", { name: "سياق العودة" });
    const bannerReturn = returnBanner.getByRole("link", { name: "العودة إلى ربحية العميل" });
    await expect(
      returnBanner.getByText("أنت هنا لإكمال بيانات أغسطس المطلوبة في ربحية العميل"),
    ).toBeVisible();
    await expect(bannerReturn).toHaveAttribute("href", expectedProfitabilityReturn);
    await bannerReturn.focus();
    await expect(bannerReturn).toBeFocused();

    const loadingActions = page.getByRole("group", { name: "إجراءات الصفحة - تحميل" });
    const readOnlyActions = page.getByRole("group", { name: "إجراءات الصفحة - عرض فقط" });
    const errorActions = page.getByRole("group", { name: "إجراءات الصفحة - خطأ" });
    const conditionalActions = page.getByRole("group", { name: "إجراءات الصفحة - شرط غير متاح" });
    const emptyActions = page.getByRole("group", { name: "إجراءات الصفحة - قائمة فارغة" });
    await expect(loadingActions).toHaveAttribute("data-action-state", "loading");
    await expect(loadingActions.getByText("جارٍ تحميل الإجراءات…")).toBeVisible();
    await expect(readOnlyActions).toHaveAttribute("data-action-state", "read-only");
    await expect(readOnlyActions.getByText("عرض فقط")).toBeVisible();
    await expect(errorActions).toHaveAttribute("data-action-state", "error");
    await expect(errorActions.getByText("تعذر تحميل الإجراءات")).toBeVisible();
    await expect(conditionalActions.getByText("لا يوجد إجراء مطلوب الآن")).toBeVisible();
    await expect(emptyActions.getByText("لا يوجد إجراء مطلوب الآن")).toBeVisible();

    const inPageError = page.getByRole("alert", { name: "تعذر تحميل تفاصيل المراجعة" });
    const retryLink = inPageError.getByRole("link", { name: "إعادة المحاولة" });
    const errorReturn = inPageError.getByRole("link", { name: "العودة إلى ربحية العميل" });
    await expect(inPageError.getByText("حدث خطأ")).toBeVisible();
    await expect(retryLink).toHaveAttribute("href", fixturePath);
    await expect(errorReturn).toHaveAttribute("href", expectedProfitabilityReturn);
    await retryLink.focus();
    await expect(retryLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(errorReturn).toBeFocused();

    await expect(page.getByRole("heading", { name: "اقتصاديات العملاء", level: 1 })).toBeVisible();
    await expect(context).toBeVisible();
    await expect(breadcrumb).toBeVisible();
    await expect(backLink).toBeVisible();

    await page.screenshot({
      path: "test-results/screenshots/navigation-foundation-desktop.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("keeps recovery controls usable at 390px without overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const htmlDimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(htmlDimensions.scrollWidth).toBeLessThanOrEqual(htmlDimensions.clientWidth + 1);

    const context = page.getByRole("region", { name: "سياق البزنس" });
    const metadataValues = context.locator('bdi[dir="ltr"]');
    await expect(context).toHaveCSS("flex-direction", "column");
    await expect(metadataValues).toHaveText(["SAR", "Asia/Riyadh"]);
    await expect(metadataValues.nth(1)).toHaveCSS("white-space", "nowrap");
    await expect(page.getByRole("navigation", { name: "مسار التنقل" })).toBeVisible();
    await expect(page.getByRole("link", { name: "العودة إلى البزنس" })).toBeVisible();

    for (const name of [
      "إجراءات الصفحة",
      "إجراءات الصفحة - تحميل",
      "إجراءات الصفحة - عرض فقط",
      "إجراءات الصفحة - خطأ",
      "إجراءات الصفحة - شرط غير متاح",
      "إجراءات الصفحة - قائمة فارغة",
    ]) {
      await expect(page.getByRole("group", { name, exact: true })).toBeVisible();
    }

    const returnBanner = page.getByRole("region", { name: "سياق العودة" });
    const bannerReturn = returnBanner.getByRole("link", { name: "العودة إلى ربحية العميل" });
    await expect(returnBanner).toBeVisible();
    await expect(bannerReturn).toBeVisible();
    const bannerBox = await returnBanner.boundingBox();
    const bannerReturnBox = await bannerReturn.boundingBox();
    expect(bannerBox).not.toBeNull();
    expect(bannerReturnBox).not.toBeNull();
    expect(bannerReturnBox?.width ?? 0).toBeGreaterThan(250);
    expect(bannerReturnBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      bannerBox?.width ?? 0,
    );

    const inPageError = page.getByRole("alert", { name: "تعذر تحميل تفاصيل المراجعة" });
    await expect(inPageError).toBeVisible();
    await expect(inPageError.getByRole("link", { name: "إعادة المحاولة" })).toBeVisible();
    await expect(inPageError.getByRole("link", { name: "العودة إلى ربحية العميل" })).toBeVisible();

    await page.screenshot({
      path: "test-results/screenshots/navigation-foundation-mobile-390.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
