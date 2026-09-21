import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-funnel-module";
const businessId = "123e4567-e89b-42d3-a456-426614174000";

/** Collects browser console and page errors so the N40 UI fixture fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N40 persistent Funnel module shell", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows one persistent Arabic RTL module with deterministic tabs", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${fixturePath}?tab=structure&month=2026-09`);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const module = page.getByRole("region", { name: "وحدة الفانلز" });
    const tabs = module.getByRole("navigation", { name: "التنقل داخل وحدة الفانلز" });

    const structure = tabs.getByRole("link", { name: "الهيكل" });
    const monthly = tabs.getByRole("link", { name: "الأداء الشهري" });
    const liquidation = tabs.getByRole("link", { name: "تسييل الإنفاق" });

    await expect(structure).toHaveAttribute("aria-current", "page");
    await expect(structure).toHaveAttribute("href", `/businesses/${businessId}/funnels`);
    await expect(monthly).toHaveAttribute(
      "href",
      `/businesses/${businessId}/funnels/monthly?month=2026-09`,
    );
    await expect(liquidation).toHaveAttribute(
      "href",
      `/businesses/${businessId}/liquidation?month=2026-09`,
    );

    await monthly.focus();
    await expect(monthly).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("marks monthly and liquidation states without changing the tab set", async ({ page }) => {
    const errors = captureBrowserErrors(page);

    await page.goto(`${fixturePath}?tab=monthly&month=2026-08`);
    let module = page.getByRole("region", { name: "وحدة الفانلز" });
    await expect(module.getByRole("link", { name: "الأداء الشهري" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(module.getByRole("link")).toHaveCount(3);

    await page.goto(`${fixturePath}?tab=liquidation&month=2026-08`);
    module = page.getByRole("region", { name: "وحدة الفانلز" });
    await expect(module.getByRole("link", { name: "تسييل الإنفاق" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(module.getByRole("link", { name: "الأداء الشهري" })).toHaveAttribute(
      "href",
      `/businesses/${businessId}/funnels/monthly?month=2026-08`,
    );

    expect(errors).toEqual([]);
  });

  test("fits the Funnel module at 390px without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?tab=monthly&month=2026-09`);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const module = page.getByRole("region", { name: "وحدة الفانلز" });
    await expect(module.getByRole("link", { name: "الهيكل" })).toBeVisible();
    await expect(module.getByRole("link", { name: "الأداء الشهري" })).toBeVisible();
    await expect(module.getByRole("link", { name: "تسييل الإنفاق" })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
