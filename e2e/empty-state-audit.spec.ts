import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-empty-state-audit";

function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N62 actionable empty-state contract", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("explains absence, normality, and a next action in Arabic RTL without mobile overflow", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const state = page.getByRole("region", { name: "حالة فارغة قابلة للتنفيذ" });
    await expect(state).toContainText("لا توجد بيانات بعد");
    await expect(state).toContainText("هذه الحالة متوقعة");
    await expect(state).toContainText("لا يعرض ميزان أرقامًا مفترضة");

    const action = state.getByRole("link", { name: "تنفيذ الخطوة التالية" });
    await expect(action).toHaveAttribute("href", "/businesses/new");
    await action.focus();
    await expect(action).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(action).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      )
      .toBe(true);

    expect(errors).toEqual([]);
  });
});
