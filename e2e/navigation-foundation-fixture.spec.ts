import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-navigation-foundation";

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

  test("renders explicit RTL breadcrumbs, deterministic Back, and business context", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const breadcrumb = page.getByRole("navigation", { name: "مسار التنقل" });
    const businessesLink = breadcrumb.getByRole("link", { name: "البزنسات" });
    const businessLink = breadcrumb.getByRole("link", { name: "أكاديمية ميزان" });
    const currentCrumb = breadcrumb.getByText("اقتصاديات العملاء", { exact: true });
    const backLink = page.getByRole("link", { name: "العودة إلى البزنس" });

    await expect(businessesLink).toHaveAttribute("href", "/businesses");
    await expect(businessLink).toHaveAttribute("href", "/businesses/business%20fixture%2F01");
    await expect(currentCrumb).toHaveAttribute("aria-current", "page");
    await expect(backLink).toHaveAttribute("href", "/businesses/business%20fixture%2F01");

    await businessesLink.focus();
    await expect(businessesLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(businessLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(backLink).toBeFocused();

    const context = page.getByRole("region", { name: "سياق البزنس" });
    await expect(context.getByText("أكاديمية ميزان", { exact: true })).toBeVisible();
    await expect(context.locator('bdi[dir="ltr"]')).toHaveText(["SAR", "Asia/Riyadh"]);

    await page.screenshot({
      path: "test-results/screenshots/navigation-foundation-desktop.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("keeps the business context and hierarchy usable at 390px without overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const htmlDimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(htmlDimensions.scrollWidth).toBeLessThanOrEqual(htmlDimensions.clientWidth + 1);

    const context = page.getByRole("region", { name: "سياق البزنس" });
    await expect(context).toHaveCSS("flex-direction", "column");
    await expect(context.locator('bdi[dir="ltr"]')).toHaveText(["SAR", "Asia/Riyadh"]);
    await expect(page.getByRole("navigation", { name: "مسار التنقل" })).toBeVisible();
    await expect(page.getByRole("link", { name: "العودة إلى البزنس" })).toBeVisible();

    await page.screenshot({
      path: "test-results/screenshots/navigation-foundation-mobile-390.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
