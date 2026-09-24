import { expect, test, type Page } from "@playwright/test";
import { expectFullScreenMobileSheet } from "./mobile-sheet-assertions";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-dashboard-metric-drawer";
const businessId = "123e4567-e89b-42d3-a456-426614174000";

/** Collects browser console and page errors so N47/N48 fail on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N47/N48 Dashboard KPI drawer and deep analysis", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("opens KPI details in-context and exposes exact deep-analysis navigation", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const trigger = page.getByRole("button", {
      name: "تفاصيل المؤشر — صافي الربح الحقيقي",
    });
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "صافي الربح الحقيقي" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", {
        name: "إغلاق تفاصيل المؤشر — صافي الربح الحقيقي",
      }),
    ).toBeFocused();

    await expect(dialog).toContainText("صافي الكاش المحصل − إجمالي تكاليف البزنس");
    await expect(dialog).toContainText("١٣٬٥٠٠ EGP");
    await expect(dialog).toContainText("٣٬٧٧٢٫٥ EGP");
    await expect(dialog).toContainText("٩٬٧٢٧٫٥ EGP");
    await expect(dialog).toContainText("محرك الحساب المركزي");

    let deepAnalysis = dialog.getByRole("link", { name: "تحليل أعمق" });
    const expectedAnalyticsHref = `/analytics?business=${businessId}&month=2026-04`;
    await expect(deepAnalysis).toHaveAttribute("href", expectedAnalyticsHref);

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

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    expect(errors).toEqual([]);

    await trigger.click();
    deepAnalysis = dialog.getByRole("link", { name: "تحليل أعمق" });
    const analyticsRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/analytics" &&
        url.searchParams.get("business") === businessId &&
        url.searchParams.get("month") === "2026-04"
      );
    });
    await deepAnalysis.click();
    const analyticsRequest = await analyticsRequestPromise;
    const requestedDestination = new URL(analyticsRequest.url());
    expect(requestedDestination.pathname).toBe("/analytics");
    expect(requestedDestination.searchParams.get("business")).toBe(businessId);
    expect(requestedDestination.searchParams.get("month")).toBe("2026-04");

    await page.waitForURL((url) => url.pathname === "/login");
    const loginDestination = new URL(page.url());
    expect(loginDestination.searchParams.get("next")).toBe(expectedAnalyticsHref);
  });

  test("uses a full-width mobile sheet without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    await page
      .getByRole("button", { name: "تفاصيل المؤشر — صافي الربح الحقيقي" })
      .click();

    const dialog = page.getByRole("dialog", { name: "صافي الربح الحقيقي" });
    await expect(dialog).toBeVisible();

    await expectFullScreenMobileSheet(page, dialog);
    await expect(dialog.getByRole("link", { name: "تحليل أعمق" })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
