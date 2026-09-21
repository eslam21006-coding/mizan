import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-liquidation-missing-data";
const businessId = "123e4567-e89b-42d3-a456-426614174000";

/** Collects browser console and page errors so N46 fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N46 Liquidation direct missing-data CTA", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("routes each known missing input directly to its exact fix", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const panel = page.getByRole("region", { name: "بيانات ناقصة لتحليل التسييل" });
    const monthly = panel.getByRole("link", { name: "فتح الإدخال الشهري" });
    const funnelMonthly = panel.getByRole("link", { name: "فتح أرقام الفانلز" });
    const allocation = panel.getByRole("link", { name: "إكمال التوزيع" });

    await expect(monthly).toHaveAttribute(
      "href",
      `/businesses/${businessId}/monthly?month=2026-09`,
    );
    await expect(funnelMonthly).toHaveAttribute(
      "href",
      `/businesses/${businessId}/funnels/monthly?month=2026-09`,
    );
    await expect(allocation).toHaveAttribute("href", "#front-end-allocations");

    await funnelMonthly.focus();
    await expect(funnelMonthly).toBeFocused();

    await allocation.click();
    await expect(page).toHaveURL(/#front-end-allocations$/);
    await expect(page.getByRole("region", { name: "توزيع Front-End" })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("renders no missing-data panel when every required input is complete", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?mode=complete`);

    await expect(
      page.getByRole("region", { name: "بيانات ناقصة لتحليل التسييل" }),
    ).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("keeps all direct fix actions usable at 390px without overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const panel = page.getByRole("region", { name: "بيانات ناقصة لتحليل التسييل" });
    await expect(panel.getByRole("link")).toHaveCount(3);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const panelBox = await panel.boundingBox();
    expect(panelBox?.width ?? 999).toBeLessThanOrEqual(390);

    expect(errors).toEqual([]);
  });
});
