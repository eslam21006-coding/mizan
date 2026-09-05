import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-setup-delete";

function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("Safe setup delete controls", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("renders clear destructive controls and requires confirmation", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const revenueDelete = page.getByRole("button", { name: "حذف مصدر الإيراد Agency" });
    const expenseDelete = page.getByRole("button", { name: "حذف المصروف رواتب" });

    for (const button of [revenueDelete, expenseDelete]) {
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(button).toHaveCSS("border-style", "solid");
    }

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("هل تريد حذف مصدر الإيراد");
      await dialog.dismiss();
    });
    await revenueDelete.click();
    await expect(page).toHaveURL(new RegExp(`${fixturePath}$`));

    await page.screenshot({
      path: "test-results/screenshots/setup-delete-fixture-desktop.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("keeps delete controls usable at 390px without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    for (const name of ["حذف مصدر الإيراد Agency", "حذف المصروف رواتب"]) {
      const button = page.getByRole("button", { name });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(250);
    }

    await page.screenshot({
      path: "test-results/screenshots/setup-delete-fixture-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
