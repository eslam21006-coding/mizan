import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-business-workspace";
const MENTEE_USER_ID = "00000000-0000-4000-8000-000000000057";

/** Captures browser runtime errors during the N58 viewing-context journey. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N58 Admin viewing a Mentee business", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows persistent explicit Admin context with an exact return-to-Mentee action", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const banner = page.getByRole("complementary", { name: "وضع عرض بزنس متدرب" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("أنت تعرض بزنس تابعًا لمتدرب");
    await expect(banner).toContainText("أي تعديل تنفذه هنا سيؤثر على بيانات هذا البزنس");

    const returnLink = banner.getByRole("link", { name: "العودة إلى المتدرب" });
    await expect(returnLink).toHaveAttribute("href", `/admin/mentees/${MENTEE_USER_ID}`);
    await returnLink.focus();
    await expect(returnLink).toBeFocused();

    await page.reload();
    await expect(banner).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await expect(returnLink).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("does not show the banner for an Admin-owned business", async ({ page }) => {
    await page.goto(`${fixturePath}?owner=self`);

    await expect(
      page.getByRole("complementary", { name: "وضع عرض بزنس متدرب" }),
    ).toHaveCount(0);
  });
});
