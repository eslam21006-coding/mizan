import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-target-planner-return";
const businessId = "123e4567-e89b-42d3-a456-426614174000";

/** Collects browser errors so the N54 return-loop fixture also guards runtime health. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N54 Target Planner missing-data return loop", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("returns to the exact originating planner step and stays RTL/mobile safe", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(
      `${fixturePath}?origin=target-planner&planner_step=assumptions&planner_goal=net_profit&planner_value=50000`,
    );

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const banner = page.getByRole("region", { name: "سياق العودة إلى خطة الهدف" });
    await expect(banner).toBeVisible();
    const returnLink = page.getByRole("link", { name: "العودة إلى خطة الهدف" });
    await expect(returnLink).toHaveAttribute(
      "href",
      `/target-plan?business=${businessId}&goal=net_profit&step=assumptions&value=50000`,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await returnLink.focus();
    await expect(returnLink).toBeFocused();

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    await page.screenshot({
      path: "test-results/screenshots/target-planner-return-mobile-390.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("fails closed for incomplete, unknown, malformed, or duplicated planner metadata", async ({ page }) => {
    for (const query of [
      "origin=target-planner&planner_goal=revenue",
      "origin=target-planner&planner_step=plan",
      "origin=target-planner&planner_step=unknown&planner_goal=revenue",
      "origin=target-planner&planner_step=plan&planner_goal=unknown",
      "origin=target-planner&planner_step=plan&planner_goal=revenue&planner_value=50000%3Cscript%3E",
      "origin=target-planner&planner_step=goal&planner_step=plan&planner_goal=revenue",
    ]) {
      await page.goto(`${fixturePath}?${query}`);
      await expect(page.getByRole("region", { name: "سياق العودة إلى خطة الهدف" })).toHaveCount(0);
    }
  });
});
