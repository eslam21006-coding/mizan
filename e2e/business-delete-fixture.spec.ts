import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-business-delete";

function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("Business deletion confirmation", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("keeps deletion disabled until Arabic or English confirmation is typed", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const input = page.getByLabel("للتأكيد اكتب «حذف» أو «Delete»");
    const button = page.getByRole("button", { name: "حذف Mizan Founder Test" });

    await expect(input).toBeVisible();
    await expect(button).toBeDisabled();

    await input.fill("حذف البزنس");
    await expect(button).toBeDisabled();

    await input.fill("حذف");
    await expect(button).toBeEnabled();

    await input.fill("Delete");
    await expect(button).toBeEnabled();

    await page.screenshot({
      path: "test-results/screenshots/business-delete-fixture-desktop.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("remains usable at 390px without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const input = page.getByLabel("للتأكيد اكتب «حذف» أو «Delete»");
    const button = page.getByRole("button", { name: "حذف Mizan Founder Test" });
    await input.fill("Delete");
    await expect(button).toBeEnabled();

    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(250);

    await page.screenshot({
      path: "test-results/screenshots/business-delete-fixture-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
