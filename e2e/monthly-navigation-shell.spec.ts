import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-monthly-navigation-shell";

/** Collects browser runtime failures while Monthly hierarchy is exercised. */
function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N23 + N24 Monthly navigation shell", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("keeps deterministic Back separate from workflow Return and shows business context", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const context = page.getByRole("region", { name: "سياق البزنس" });
    await expect(context.getByText("أكاديمية ميزان", { exact: true })).toBeVisible();
    await expect(context.locator('bdi[dir="ltr"]')).toHaveText(["SAR", "Asia/Riyadh"]);

    const breadcrumb = page.getByRole("navigation", { name: "مسار التنقل" });
    const businessesLink = breadcrumb.getByRole("link", { name: "البزنسات" });
    const businessLink = breadcrumb.getByRole("link", { name: "أكاديمية ميزان" });
    const currentCrumb = breadcrumb.getByText("الإدخال الشهري", { exact: true });
    const businessOverviewHref = "/?business=business+fixture%2Fmonthly";

    await expect(businessesLink).toHaveAttribute("href", "/businesses");
    await expect(businessLink).toHaveAttribute("href", businessOverviewHref);
    await expect(currentCrumb).toHaveAttribute("aria-current", "page");

    const backLink = page.getByRole("link", { name: "العودة إلى البزنس" });
    const returnLink = page.getByRole("link", { name: "العودة إلى ربحية العميل" });
    await expect(backLink).toHaveAttribute("href", businessOverviewHref);
    await expect(returnLink).toHaveAttribute(
      "href",
      "/businesses/business%20fixture%2Fmonthly/customers?view=profitability&month=2026-08",
    );

    await businessesLink.focus();
    await expect(businessesLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(businessLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(backLink).toBeFocused();

    expect(await backLink.getAttribute("href")).not.toBe(await returnLink.getAttribute("href"));
    expect(errors).toEqual([]);
  });

  test("remains usable in Arabic RTL at 390px without horizontal overflow", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    await expect(page.getByRole("region", { name: "سياق البزنس" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "مسار التنقل" })).toBeVisible();
    await expect(page.getByRole("link", { name: "العودة إلى البزنس" })).toBeVisible();
    await expect(page.getByRole("link", { name: "العودة إلى ربحية العميل" })).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      )
      .toBe(true);

    expect(errors).toEqual([]);
  });
});
