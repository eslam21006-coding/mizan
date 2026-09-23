import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-admin-mentee-hierarchy";
const MENTEE_A = "00000000-0000-4000-8000-000000000571";
const BUSINESS_A = "00000000-0000-4000-8000-000000000573";
const BUSINESS_B = "00000000-0000-4000-8000-000000000574";

function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N57 Admin Mentee hierarchy", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("navigates Admin → Mentee → owned businesses with one primary level at a time", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "المتدربون", level: 1 })).toBeVisible();

    const directory = page.getByRole("region", { name: "قائمة المتدربين" });
    await expect(directory.getByRole("article")).toHaveCount(2);
    await expect(directory.getByRole("link", { name: "فتح المتدرب" })).toHaveCount(2);
    await expect(page.getByRole("link", { name: "فتح البزنس" })).toHaveCount(0);

    const firstMenteeLink = directory.getByRole("link", { name: "فتح المتدرب" }).first();
    await firstMenteeLink.focus();
    await expect(firstMenteeLink).toBeFocused();
    await firstMenteeLink.click();

    await expect(page).toHaveURL(new RegExp(`mentee=${MENTEE_A}$`));
    await expect(page.getByRole("heading", { name: "تفاصيل المتدرب", level: 1 })).toBeVisible();

    const breadcrumb = page.getByRole("navigation", { name: "مسار إدارة المتدرب" });
    await expect(breadcrumb.getByRole("link", { name: "المتدربون" })).toHaveAttribute(
      "href",
      "/admin/mentees",
    );
    await expect(
      breadcrumb.getByText(
        "very.long.unbroken.mentee.account.identifier.for.mobile.layout@example.test",
        { exact: true },
      ),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "العودة إلى المتدربين" })).toHaveAttribute(
      "href",
      "/admin/mentees",
    );

    const businesses = page.getByRole("region", { name: "بزنسات المتدرب" });
    await expect(businesses.getByRole("article")).toHaveCount(2);
    const openBusinessLinks = businesses.getByRole("link", { name: "فتح البزنس" });
    await expect(openBusinessLinks).toHaveCount(2);
    await expect(openBusinessLinks.nth(0)).toHaveAttribute(
      "href",
      `/?business=${BUSINESS_A}`,
    );
    await expect(openBusinessLinks.nth(1)).toHaveAttribute(
      "href",
      `/?business=${BUSINESS_B}`,
    );

    await page.reload();
    await expect(page.getByRole("heading", { name: "تفاصيل المتدرب", level: 1 })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "المتدربون", level: 1 })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("keeps long Mentee identity and child business actions usable at 390px", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?mentee=${MENTEE_A}`);

    await expect(page.getByRole("navigation", { name: "مسار إدارة المتدرب" })).toBeVisible();
    await expect(page.getByRole("link", { name: "العودة إلى المتدربين" })).toBeVisible();

    const email = page.getByRole("heading", {
      name: "very.long.unbroken.mentee.account.identifier.for.mobile.layout@example.test",
      level: 2,
    });
    await expect(email).toBeVisible();

    const openBusinessLinks = page.getByRole("link", { name: "فتح البزنس" });
    await expect(openBusinessLinks).toHaveCount(2);
    await openBusinessLinks.first().focus();
    await expect(openBusinessLinks.first()).toBeFocused();

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    await page.screenshot({
      path: "test-results/screenshots/admin-mentee-hierarchy-mobile-390.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
