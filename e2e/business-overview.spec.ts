import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-business-overview";

/** Captures console and page errors so N37 browser verification fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N37 Business Overview setup health", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows setup health, monthly status, and one primary next action in Arabic RTL", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const workspace = page.getByRole("region", { name: "مساحة عمل البزنس", exact: true });
    await expect(workspace).toContainText("أكاديمية ميزان");
    await expect(
      workspace.getByRole("link", { name: "نظرة عامة" }),
    ).toHaveAttribute("aria-current", "page");

    await expect(page.getByRole("heading", { name: "هل البزنس جاهز للإدخال الشهري؟" })).toBeVisible();
    await expect(page.getByText("USD", { exact: true })).toBeVisible();
    await expect(page.getByText("Africa/Cairo", { exact: true })).toBeVisible();
    await expect(page.getByText("الإعداد جاهز", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "أين وصلت بيانات البزنس؟" })).toBeVisible();
    await expect(page.getByText("لم يُحفظ بعد", { exact: true })).toBeVisible();

    const primaryAction = page.getByRole("link", { name: /^فتح أرقام / });
    await expect(primaryAction).toHaveCount(1);
    await expect(primaryAction).toHaveAttribute(
      "href",
      `/businesses/${businessIdForTest()}/monthly?month=2026-09`,
    );
    await primaryAction.focus();
    await expect(primaryAction).toBeFocused();

    expect(errors).toEqual([]);
  });

  test("fits setup-health cards at 390px without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    await expect(page.getByText("الإعداد جاهز", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /^فتح أرقام / })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

function businessIdForTest() {
  return "123e4567-e89b-42d3-a456-426614174000";
}
