import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-monthly-entry";

function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("Monthly entry UX fixture", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("renders compact RTL entry groups with button-like month navigation", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الإدخال الشهري", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "الإيرادات والمرتجعات", level: 2 })).toBeVisible();
    await expect(page.getByRole("table", { name: "الإيرادات والمرتجعات حسب المصدر" })).toBeVisible();

    for (const name of ["الشهر السابق", "الشهر التالي"]) {
      const navigation = page.getByRole("link", { name });
      const box = await navigation.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(navigation).toHaveCSS("border-style", "solid");
    }

    await expect(page.getByText("إدخال يدوي", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("الإجمالي محسوب تلقائيًا", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("28,000 USD", { exact: true })).toBeVisible();
    await expect(page.getByText("19,000 USD", { exact: true })).toBeVisible();

    await page.screenshot({
      path: "test-results/screenshots/monthly-entry-fixture-desktop.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("updates per-stream net without treating blank inputs as zero", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto(fixturePath);

    const gross = page.getByLabel("الإيراد المحصل — Front-End Offer");
    const refunds = page.getByLabel("المرتجعات — Front-End Offer");

    await gross.fill("");
    await expect(page.getByText("أدخل المحصل والمرتجعات لإظهار الصافي.").first()).toBeVisible();

    await gross.fill("31000");
    await refunds.fill("1000");
    await expect(page.getByText("30,000 USD", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("stays usable at 390px with no page-level horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    for (const label of [
      "الإيراد المحصل — Front-End Offer",
      "المرتجعات — Front-End Offer",
      "عملاء جدد",
      "Meta Ads — القيمة الشهرية",
    ]) {
      await expect(page.getByLabel(label)).toBeVisible();
    }

    const saveButton = page.getByRole("button", { name: "حفظ الشهر" });
    const saveBox = await saveButton.boundingBox();
    expect(saveBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await page.screenshot({
      path: "test-results/screenshots/monthly-entry-fixture-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
