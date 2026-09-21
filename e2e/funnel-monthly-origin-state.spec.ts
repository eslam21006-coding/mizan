import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-funnel-module";
const businessId = "123e4567-e89b-42d3-a456-426614174000";

/** Collects browser console and page errors so N45 fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N45 Funnel Structure to Monthly origin state", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("marks Structure to Monthly and preserves the deterministic Return state", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.goto(`${fixturePath}?tab=structure&month=2026-09`);
    const monthlyFromStructure = page.getByRole("link", { name: "الأداء الشهري" });
    await expect(monthlyFromStructure).toHaveAttribute(
      "href",
      `/businesses/${businessId}/funnels/monthly?month=2026-09&origin=funnel-structure`,
    );

    await page.goto(
      `${fixturePath}?tab=monthly&month=2026-08&origin=funnel-structure`,
    );

    const banner = page.getByRole("region", {
      name: "سياق العودة من أرقام الفانلز الشهرية",
    });
    await expect(banner).toBeVisible();
    const returnLink = banner.getByRole("link", { name: "العودة إلى هيكل الفانلز" });
    await expect(returnLink).toHaveAttribute(
      "href",
      `/businesses/${businessId}/funnels`,
    );

    const activeMonthly = page.getByRole("link", { name: "الأداء الشهري" });
    await expect(activeMonthly).toHaveAttribute(
      "href",
      `/businesses/${businessId}/funnels/monthly?month=2026-08&origin=funnel-structure`,
    );

    await page.reload();
    await expect(banner).toBeVisible();
    await expect(returnLink).toHaveAttribute(
      "href",
      `/businesses/${businessId}/funnels`,
    );

    expect(errors).toEqual([]);
  });

  test("fails closed for unknown or duplicated Funnel origins", async ({ page }) => {
    const errors = captureBrowserErrors(page);

    for (const query of [
      "tab=monthly&month=2026-08&origin=https%3A%2F%2Fevil.example",
      "tab=monthly&month=2026-08&origin=funnel-structure&origin=funnel-structure",
      "tab=monthly&month=2026-08&origin=customer-overview",
    ]) {
      await page.goto(`${fixturePath}?${query}`);
      await expect(
        page.getByRole("region", { name: "سياق العودة من أرقام الفانلز الشهرية" }),
      ).toHaveCount(0);
    }

    expect(errors).toEqual([]);
  });

  test("keeps the Return state usable at 390px without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      `${fixturePath}?tab=monthly&month=2026-08&origin=funnel-structure`,
    );

    const returnLink = page.getByRole("link", { name: "العودة إلى هيكل الفانلز" });
    await expect(returnLink).toBeVisible();
    await returnLink.focus();
    await expect(returnLink).toBeFocused();

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    expect(errors).toEqual([]);
  });
});
