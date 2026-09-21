import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-business-workspace";

function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N36 business workspace shell", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("renders persistent Arabic RTL business context and four safe local tabs", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const workspace = page.getByRole("region", { name: "مساحة عمل البزنس" });
    await expect(workspace).toContainText("أكاديمية ميزان");
    await expect(workspace).toContainText("USD");
    await expect(workspace).toContainText("Africa/Cairo");

    const navigation = page.getByRole("navigation", { name: "التنقل داخل البزنس" });
    const tabs = navigation.getByRole("link");
    await expect(tabs).toHaveCount(4);

    await expect(navigation.getByRole("link", { name: "نظرة عامة" })).toHaveAttribute(
      "href",
      "/businesses/123e4567-e89b-42d3-a456-426614174000",
    );
    await expect(navigation.getByRole("link", { name: "مصادر الإيراد" })).toHaveAttribute(
      "href",
      "/businesses/123e4567-e89b-42d3-a456-426614174000/revenue-streams",
    );
    const expenses = navigation.getByRole("link", { name: "هيكل المصروفات" });
    await expect(expenses).toHaveAttribute(
      "href",
      "/businesses/123e4567-e89b-42d3-a456-426614174000/expenses",
    );
    await expect(expenses).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByRole("link", { name: "الإعدادات" })).toHaveAttribute(
      "href",
      "/businesses/123e4567-e89b-42d3-a456-426614174000/settings",
    );

    await navigation.getByRole("link", { name: "الإعدادات" }).focus();
    await expect(navigation.getByRole("link", { name: "الإعدادات" })).toBeFocused();

    await page.reload();
    await expect(
      page.getByRole("navigation", { name: "التنقل داخل البزنس" }).getByRole("link", {
        name: "هيكل المصروفات",
      }),
    ).toHaveAttribute("aria-current", "page");

    expect(errors).toEqual([]);
  });

  test("fits the workspace shell at 390px without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const navigation = page.getByRole("navigation", { name: "التنقل داخل البزنس" });
    await expect(navigation.getByRole("link")).toHaveCount(4);
    for (const label of ["نظرة عامة", "مصادر الإيراد", "هيكل المصروفات", "الإعدادات"]) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }

    expect(errors).toEqual([]);
  });
});
