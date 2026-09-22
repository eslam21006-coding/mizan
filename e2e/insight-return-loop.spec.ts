import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-insight-return";
const businessId = "123e4567-e89b-42d3-a456-426614174000";

function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N50 originating-insight return loop", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("returns to the exact business insight and remains keyboard-safe at 390px", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(
      `${fixturePath}?origin=insights&month=2026-09&insight_rule=unhealthy_growth`,
    );

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const banner = page.getByRole("region", { name: "سياق العودة إلى الملاحظة" });
    await expect(banner).toBeVisible();
    const returnLink = page.getByRole("link", { name: "العودة إلى الملاحظة" });
    await expect(returnLink).toHaveAttribute(
      "href",
      `/insights?business=${businessId}&month=2026-09#insight-unhealthy_growth`,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await returnLink.focus();
    await expect(returnLink).toBeFocused();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });

  test("returns a funnel insight to its exact originating card", async ({ page }) => {
    await page.goto(
      `${fixturePath}?origin=insights&month=2026-09&insight_rule=funnel_attendance_bottleneck&insight_subject=funnel-a`,
    );

    await expect(page.getByRole("link", { name: "العودة إلى الملاحظة" })).toHaveAttribute(
      "href",
      `/insights?business=${businessId}&month=2026-09#insight-funnel_attendance_bottleneck%3Afunnel-a`,
    );
  });

  test("fails closed when rule metadata is unknown, incomplete, or duplicated", async ({ page }) => {
    for (const query of [
      "origin=insights&month=2026-09&insight_rule=not-a-rule",
      "origin=insights&month=2026-09&insight_rule=funnel_attendance_bottleneck",
      "origin=insights&month=2026-09&insight_rule=unhealthy_growth&insight_subject=unexpected",
      "origin=insights&month=2026-09&insight_rule=unhealthy_growth&insight_rule=non_media_cost_pressure",
    ]) {
      await page.goto(`${fixturePath}?${query}`);
      await expect(page.getByRole("region", { name: "سياق العودة إلى الملاحظة" })).toHaveCount(0);
    }
  });
});
