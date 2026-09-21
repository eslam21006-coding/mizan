import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-business-cards";

/** Captures browser console and page errors so business-card verification fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N35 simplified business cards", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows one primary workspace action per business in Arabic RTL", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const firstCard = page.getByRole("article", { name: "بزنس أكاديمية ميزان" });
    await expect(firstCard).toBeVisible();
    await expect(firstCard).toContainText("USD");
    await expect(firstCard).toContainText("دولار أمريكي");
    await expect(firstCard).toContainText("القاهرة");

    const firstLinks = firstCard.getByRole("link");
    await expect(firstLinks).toHaveCount(1);
    const openLink = firstCard.getByRole("link", { name: "فتح البزنس" });
    await expect(openLink).toHaveAttribute(
      "href",
      "/businesses/123e4567-e89b-42d3-a456-426614174000",
    );

    const secondCard = page.getByRole("article", { name: "بزنس بزنس التدريب" });
    await expect(secondCard.getByRole("link")).toHaveCount(1);
    await expect(secondCard.getByRole("link", { name: "فتح البزنس" })).toHaveAttribute(
      "href",
      "/businesses/123e4567-e89b-42d3-a456-426614174001",
    );

    await expect(page.getByRole("link", { name: "إدارة مصادر الإيراد" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "إدارة المصروفات" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "إدارة الفانلز" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "الإدخال الشهري" })).toHaveCount(0);

    await openLink.focus();
    await expect(openLink).toBeFocused();

    expect(errors).toEqual([]);
  });

  test("business cards stay within a 390px viewport without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(2);
    await expect(cards.first().getByRole("link", { name: "فتح البزنس" })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
