import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const overviewPath = "/auth/e2e-customers-overview";
const reviewPath = "/auth/e2e-customer-economics-review";
const overviewBusinessId = "00000000-0000-4000-8000-000000000057";
const reviewBusinessId = "99999999-9999-4999-8999-999999999999";

test.describe("Customer Review navigation", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows Review contextually for known or uncertain work and hides it for a clean state", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto(overviewPath);
    const heroHeading = page.getByRole("heading", { name: "العملاء وقيمة وربحية العميل" });
    const hero = page.locator("section").filter({ has: heroHeading });
    await expect(hero.getByRole("link")).toHaveCount(1);
    await expect(hero.getByRole("link", { name: "استيراد معاملات" })).toBeVisible();

    const reviewNotice = page.getByRole("region", { name: "مراجعة اقتصاديات العميل" });
    await expect(reviewNotice).toBeVisible();
    await expect(reviewNotice.getByRole("heading", { name: "هناك ملاحظات تحتاج مراجعتك" })).toBeVisible();
    await expect(reviewNotice.getByText(/2 ملاحظة/)).toBeVisible();
    const reviewLink = reviewNotice.getByRole("link", { name: "فتح المراجعة" });
    await expect(reviewLink).toHaveAttribute(
      "href",
      `/businesses/${overviewBusinessId}/customers/review`,
    );
    await reviewLink.focus();
    await expect(reviewLink).toBeFocused();

    await page.goto(`${overviewPath}?review=clean`);
    await expect(page.getByRole("region", { name: "مراجعة اقتصاديات العميل" })).toHaveCount(0);

    await page.goto(`${overviewPath}?review=error`);
    const uncertainNotice = page.getByRole("region", { name: "مراجعة اقتصاديات العميل" });
    await expect(uncertainNotice).toBeVisible();
    await expect(
      uncertainNotice.getByRole("heading", { name: "تعذر التحقق من حالة المراجعة" }),
    ).toBeVisible();
    await expect(uncertainNotice.getByText(/لا يتم اعتبار حالة غير معروفة نظيفة بالخطأ/)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(uncertainNotice).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    expect(browserErrors).toEqual([]);
  });

  test("gives Review a deterministic breadcrumb and Back parent in Arabic RTL", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto(reviewPath);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const breadcrumb = page.getByRole("navigation", { name: "مسار مراجعة اقتصاديات العميل" });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole("link", { name: "البزنسات" })).toHaveAttribute("href", "/businesses");
    await expect(breadcrumb.getByRole("link", { name: "بزنس مراجعة الاختبار" })).toHaveAttribute(
      "href",
      `/?business=${reviewBusinessId}`,
    );
    await expect(breadcrumb.getByRole("link", { name: "العملاء وقيمة العميل" })).toHaveAttribute(
      "href",
      `/businesses/${reviewBusinessId}/customers`,
    );
    await expect(breadcrumb.getByText("المراجعة", { exact: true })).toHaveAttribute("aria-current", "page");

    const backLink = page.getByRole("link", { name: "العودة للعملاء وقيمة العميل" });
    await expect(backLink).toHaveAttribute("href", `/businesses/${reviewBusinessId}/customers`);
    await backLink.focus();
    await expect(backLink).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(breadcrumb).toBeVisible();
    await expect(backLink).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    expect(browserErrors).toEqual([]);
  });
});
