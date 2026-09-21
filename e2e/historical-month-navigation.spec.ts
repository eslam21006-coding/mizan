import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-historical-month";

function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N32 + N33 + N34 historical month UX", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows historical state and exact-month correction navigation in Arabic RTL", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await expect(page.getByText("شهر تاريخي", { exact: true })).toBeVisible();
    const correctionSuccess = page.locator(
      '[role="status"][aria-label="تأكيد التصحيح التاريخي"]',
    );
    await expect(correctionSuccess).toBeVisible();
    await expect(correctionSuccess).toContainText("تم حفظ التصحيح التاريخي");
    await expect(correctionSuccess).toContainText("يوليو ٢٠٢٦");
    const correctionLink = page.getByRole("link", { name: "بدء تصحيح تاريخي" });
    await expect(correctionLink).toHaveAttribute(
      "href",
      "/businesses/123e4567-e89b-42d3-a456-426614174000/monthly/correction?month=2026-07",
    );

    await expect(page.getByRole("navigation", { name: "مسار التنقل" })).toContainText(
      "تصحيح تاريخي",
    );
    const backLink = page.getByRole("link", { name: /العودة إلى يوليو/ });
    await expect(backLink).toHaveAttribute(
      "href",
      "/businesses/123e4567-e89b-42d3-a456-426614174000/monthly?month=2026-07",
    );

    expect(errors).toEqual([]);
  });

  test("historical treatment stays within 390px without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    await page.getByRole("link", { name: "بدء تصحيح تاريخي" }).focus();
    await expect(page.getByRole("link", { name: "بدء تصحيح تاريخي" })).toBeFocused();

    expect(errors).toEqual([]);
  });
});
