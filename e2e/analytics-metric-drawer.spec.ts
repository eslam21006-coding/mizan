import { expect, test, type Page } from "@playwright/test";
import { expectFullScreenMobileSheet } from "./mobile-sheet-assertions";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-analytics-metric-drawer";

/** Collects browser console and page errors so N52 fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N52 Analytics metric details drawer", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows both months' exact audit trails in-context and restores focus", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const trigger = page.getByRole("button", {
      name: "تفاصيل المؤشر — صافي الربح الحقيقي",
    });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "صافي الربح الحقيقي" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", {
        name: "إغلاق تفاصيل المؤشر — صافي الربح الحقيقي",
      }),
    ).toBeFocused();

    await expect(dialog.getByRole("region", { name: "تفاصيل أغسطس ٢٠٢٦" })).toBeVisible();
    await expect(dialog.getByRole("region", { name: "تفاصيل يوليو ٢٠٢٦" })).toBeVisible();
    await expect(dialog).toContainText("صافي الكاش المحصل − إجمالي تكاليف البزنس");
    await expect(dialog).toContainText("محرك الحساب المركزي");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    if (dialogBox) {
      const outsideX =
        dialogBox.x > 20
          ? Math.max(8, dialogBox.x / 2)
          : Math.min(1272, dialogBox.x + dialogBox.width + 24);
      await page.mouse.click(outsideX, 80);
    }
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    expect(errors).toEqual([]);
  });

  test("uses a full-width RTL mobile sheet without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    await page
      .getByRole("button", { name: "تفاصيل المؤشر — صافي الربح الحقيقي" })
      .click();

    const dialog = page.getByRole("dialog", { name: "صافي الربح الحقيقي" });
    await expect(dialog).toBeVisible();

    await expectFullScreenMobileSheet(page, dialog);

    await page.screenshot({
      path: "test-results/screenshots/analytics-metric-drawer-mobile-390.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
