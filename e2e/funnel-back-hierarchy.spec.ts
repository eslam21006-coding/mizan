import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-funnel-module";
const businessId = "123e4567-e89b-42d3-a456-426614174000";

/** Collects browser console and page errors so N41 fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N41 Funnel Back hierarchy", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("returns every Funnel tab to the current business and preserves month context", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.goto(`${fixturePath}?tab=structure&month=2026-09`);
    let back = page.getByRole("link", { name: "العودة إلى البزنس" });
    await expect(back).toHaveAttribute("href", `/?business=${businessId}`);

    await page.goto(`${fixturePath}?tab=monthly&month=2026-08`);
    back = page.getByRole("link", { name: "العودة إلى البزنس" });
    await expect(back).toHaveAttribute(
      "href",
      `/?business=${businessId}&month=2026-08`,
    );

    await page.goto(`${fixturePath}?tab=liquidation&month=2026-07`);
    back = page.getByRole("link", { name: "العودة إلى البزنس" });
    await expect(back).toHaveAttribute(
      "href",
      `/?business=${businessId}&month=2026-07`,
    );

    await back.focus();
    await expect(back).toBeFocused();

    expect(errors).toEqual([]);
  });

  test("keeps deterministic Back visible at 390px without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?tab=monthly&month=2026-09`);

    const back = page.getByRole("link", { name: "العودة إلى البزنس" });
    await expect(back).toBeVisible();

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    expect(errors).toEqual([]);
  });
});
