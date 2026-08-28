import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-metric-audit";

function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("CI-only metric audit fixture", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("opens the Ultimate CAC audit and explains the exact source structure", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.goto(fixturePath);

    await expect(page.getByRole("heading", { name: "Ultimate CAC" })).toBeVisible();
    const disclosure = page.getByText("الرقم ده جاي منين؟", { exact: true });
    await expect(disclosure).toBeVisible();
    await disclosure.click();

    await expect(page.getByText("إجمالي تكاليف البزنس ÷ العملاء الجدد", { exact: true })).toBeVisible();
    await expect(page.getByText("تكاليف الاكتساب", { exact: true })).toBeVisible();
    await expect(page.getByText("تكاليف التنفيذ وخدمة العملاء", { exact: true })).toBeVisible();
    await expect(page.getByText("المصاريف التشغيلية العامة", { exact: true })).toBeVisible();
    await expect(page.getByText("المصاريف المالية", { exact: true })).toBeVisible();
    await expect(page.getByText(/التكلفة الكاملة للبزنس لكل عميل جديد/)).toBeVisible();
    await expect(page.getByText(/ليس CAC التقليدي/)).toBeVisible();
    await expect(page.getByText("٨٤٢ USD", { exact: true })).toHaveCount(2);

    await page.screenshot({
      path: "test-results/screenshots/metric-audit-ultimate-cac.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("remains usable without page-level horizontal overflow on mobile", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    await page.getByText("الرقم ده جاي منين؟", { exact: true }).click();
    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    await expect(page.getByText("إجمالي تكاليف البزنس ÷ العملاء الجدد", { exact: true })).toBeVisible();
    await page.screenshot({
      path: "test-results/screenshots/metric-audit-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
