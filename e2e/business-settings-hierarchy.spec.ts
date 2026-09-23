import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-business-settings-hierarchy";
const BUSINESS_ID = "123e4567-e89b-42d3-a456-426614174000";
const SECOND_BUSINESS_ID = "123e4567-e89b-42d3-a456-426614174001";

/** Captures browser runtime errors during the N59 Settings hierarchy journey. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N59 Business Settings hierarchy", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("keeps global Settings as a selector with one canonical action per business", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const firstCard = page.getByRole("article", { name: "إعدادات بزنس أكاديمية ميزان" });
    const secondCard = page.getByRole("article", { name: "إعدادات بزنس بزنس التدريب" });
    await expect(firstCard.getByRole("link")).toHaveCount(1);
    await expect(secondCard.getByRole("link")).toHaveCount(1);
    await expect(firstCard.getByRole("link", { name: "فتح إعدادات البزنس" })).toHaveAttribute(
      "href",
      `/businesses/${BUSINESS_ID}/settings`,
    );
    await expect(secondCard.getByRole("link", { name: "فتح إعدادات البزنس" })).toHaveAttribute(
      "href",
      `/businesses/${SECOND_BUSINESS_ID}/settings`,
    );

    const settingsSelector = page.getByRole("region", { name: "اختيار بزنس للإعدادات" });
    for (const oldAction of [
      "مصادر الإيراد",
      "هيكل المصروفات",
      "الفانلز",
      "العملاء و LTV",
      "الأرقام الشهرية",
      "حذف البزنس",
    ]) {
      await expect(settingsSelector.getByRole("link", { name: oldAction, exact: true })).toHaveCount(0);
    }

    expect(errors).toEqual([]);
  });

  test("shows selected Business Settings with exact local hierarchy and canonical delete route", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${fixturePath}?view=business`);

    const settingsTab = page
      .getByRole("navigation", { name: "التنقل داخل البزنس" })
      .getByRole("link", { name: "الإعدادات" });
    await expect(settingsTab).toHaveAttribute("aria-current", "page");

    const breadcrumb = page.getByRole("navigation", { name: "مسار إعدادات البزنس" });
    await expect(breadcrumb).toContainText("البزنسات");
    await expect(breadcrumb).toContainText("أكاديمية ميزان");
    await expect(breadcrumb.getByText("الإعدادات", { exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await expect(page.getByRole("link", { name: "العودة إلى نظرة عامة" })).toHaveAttribute(
      "href",
      `/businesses/${BUSINESS_ID}`,
    );

    const deleteLink = page.getByRole("link", { name: "حذف البزنس" });
    await expect(deleteLink).toHaveAttribute(
      "href",
      `/businesses/${BUSINESS_ID}/settings/delete`,
    );
    await deleteLink.focus();
    await expect(deleteLink).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await expect(deleteLink).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("hides destructive settings when the viewer cannot delete the business", async ({ page }) => {
    await page.goto(`${fixturePath}?view=readonly`);
    await expect(page.getByRole("link", { name: "حذف البزنس" })).toHaveCount(0);
  });
});
