import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-funnel-list";

/** Collects browser console and page errors so N42 fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N42 simplified Funnel list", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows compact Funnel identity and reveals the existing editor only on demand", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const list = page.getByRole("region", { name: "اختبار قائمة الفانلز" });
    await expect(list.getByText("ويبينار البرنامج الأساسي", { exact: true })).toBeVisible();
    await expect(list.getByText("تحدي قديم", { exact: true })).toBeVisible();
    await expect(list.getByText("نشطة", { exact: true })).toBeVisible();
    await expect(list.getByText("غير نشطة", { exact: true })).toBeVisible();
    await expect(list.getByText("Webinar / ويبينار", { exact: true })).toBeVisible();

    const firstCard = list.locator("details").first();
    await expect(firstCard.locator("form")).toBeHidden();
    const summary = firstCard.locator("summary");
    await summary.focus();
    await expect(summary).toBeFocused();
    await summary.click();
    await expect(firstCard).toHaveAttribute("open", "");
    await expect(firstCard.locator("form")).toBeVisible();
    await expect(firstCard.getByRole("button", { name: "حفظ التعديلات" })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("keeps a stable read-only action state without exposing edit controls", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?mode=read-only`);

    const list = page.getByRole("region", { name: "اختبار قائمة الفانلز" });
    await expect(list.getByText("عرض فقط")).toHaveCount(2);
    await expect(list.locator("details")).toHaveCount(0);
    await expect(list.getByRole("button", { name: "حفظ التعديلات" })).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("fits the compact Funnel list at 390px without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const firstCard = page.locator("details").first();
    await expect(firstCard.locator("summary")).toBeVisible();
    await firstCard.locator("summary").click();
    await expect(firstCard.locator("form")).toBeVisible();

    const expandedDimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(expandedDimensions.scrollWidth).toBeLessThanOrEqual(expandedDimensions.clientWidth + 1);

    expect(errors).toEqual([]);
  });
});
