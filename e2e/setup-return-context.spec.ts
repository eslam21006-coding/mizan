import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-setup-return";
const businessId = "123e4567-e89b-42d3-a456-426614174000";

function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N26 Revenue Sources setup return context", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("returns to the exact originating Monthly month and survives refresh", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${fixturePath}?origin=monthly-editor&month=2026-09`);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("region", { name: "سياق العودة من إعداد مصادر الإيراد" }),
    ).toBeVisible();

    const returnLink = page.getByRole("link", { name: "العودة إلى الإدخال الشهري" });
    await expect(returnLink).toHaveAttribute(
      "href",
      `/businesses/${businessId}/monthly?month=2026-09`,
    );

    await page.reload();
    await expect(returnLink).toHaveAttribute(
      "href",
      `/businesses/${businessId}/monthly?month=2026-09`,
    );
    expect(errors).toEqual([]);
  });

  test("fails closed for invalid or duplicated return metadata", async ({ page }) => {
    const errors = captureBrowserErrors(page);

    await page.goto(`${fixturePath}?origin=monthly-editor&month=2026-13`);
    await expect(
      page.getByRole("region", { name: "سياق العودة من إعداد مصادر الإيراد" }),
    ).toHaveCount(0);

    await page.goto(
      `${fixturePath}?origin=monthly-editor&origin=monthly-editor&month=2026-09`,
    );
    await expect(
      page.getByRole("region", { name: "سياق العودة من إعداد مصادر الإيراد" }),
    ).toHaveCount(0);

    await page.goto(`${fixturePath}?origin=https%3A%2F%2Fevil.example&month=2026-09`);
    await expect(
      page.getByRole("region", { name: "سياق العودة من إعداد مصادر الإيراد" }),
    ).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("keeps the return context usable at 390px without overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?origin=monthly-editor&month=2026-09`);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const returnLink = page.getByRole("link", { name: "العودة إلى الإدخال الشهري" });
    await expect(returnLink).toBeVisible();
    await returnLink.focus();
    await expect(returnLink).toBeFocused();

    expect(errors).toEqual([]);
  });
});


test.describe("N27 Expenses setup return context", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("returns to the exact originating Monthly month in Arabic RTL", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(
      `${fixturePath}?target=expenses&origin=monthly-editor&month=2026-09`,
    );

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("region", { name: "سياق العودة من إعداد المصروفات" }),
    ).toBeVisible();

    const returnLink = page.getByRole("link", { name: "العودة إلى الإدخال الشهري" });
    await expect(returnLink).toHaveAttribute(
      "href",
      `/businesses/${businessId}/monthly?month=2026-09`,
    );

    await page.reload();
    await expect(returnLink).toHaveAttribute(
      "href",
      `/businesses/${businessId}/monthly?month=2026-09`,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    await returnLink.focus();
    await expect(returnLink).toBeFocused();

    expect(errors).toEqual([]);
  });
});
