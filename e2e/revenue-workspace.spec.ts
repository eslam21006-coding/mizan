import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-revenue-workspace";
const businessId = "123e4567-e89b-42d3-a456-426614174000";

/** Captures browser console and page errors so N38 fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N38 Revenue Sources inside Business workspace", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("keeps business hierarchy, active tab, and primary create action in Arabic RTL", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const workspace = page.getByRole("region", { name: "مساحة عمل البزنس", exact: true });
    await expect(workspace).toContainText("أكاديمية ميزان");
    const revenueTab = workspace.getByRole("link", { name: "مصادر الإيراد" });
    await expect(revenueTab).toHaveAttribute("aria-current", "page");
    await expect(revenueTab).toHaveAttribute(
      "href",
      `/businesses/${businessId}/revenue-streams`,
    );

    const breadcrumb = page.getByRole("navigation", { name: "مسار التنقل" });
    await expect(breadcrumb.getByRole("link", { name: "البزنسات" })).toHaveAttribute(
      "href",
      "/businesses",
    );
    await expect(breadcrumb.getByRole("link", { name: "أكاديمية ميزان" })).toHaveAttribute(
      "href",
      `/businesses/${businessId}`,
    );
    await expect(breadcrumb.getByText("مصادر الإيراد", { exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const back = page.getByRole("link", { name: "العودة إلى نظرة عامة" });
    await expect(back).toHaveAttribute("href", `/businesses/${businessId}`);

    const create = page.getByRole("button", { name: "إضافة مصدر إيراد" });
    await expect(create).toBeVisible();
    await create.focus();
    await expect(create).toBeFocused();
    await create.click();
    await expect(page.getByRole("dialog", { name: "إضافة مصدر إيراد جديد" })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("fits the Revenue Sources workspace at 390px without horizontal overflow", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    await expect(page.getByRole("link", { name: "العودة إلى نظرة عامة" })).toBeVisible();
    await expect(page.getByRole("button", { name: "إضافة مصدر إيراد" })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
