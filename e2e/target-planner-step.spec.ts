import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-target-plan-steps";

/** Collects browser console and page errors so N53 fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N53 Target Planner explicit step state", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("preserves direct, refresh, Back, and target context across planner steps", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.goto(
      `${fixturePath}?business=business%20fixture%2F01&goal=net_profit&value=50000&step=assumptions`,
    );

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("planner-step-assumptions")).toBeVisible();
    await expect(page.getByRole("link", { name: /٢\. الافتراضات/ })).toHaveAttribute(
      "aria-current",
      "step",
    );

    const planLink = page.getByRole("link", { name: /٣\. الخطة/ });
    const planHref = await planLink.getAttribute("href");
    expect(planHref).not.toBeNull();
    const planUrl = new URL(planHref!, "http://127.0.0.1:3000");
    expect(planUrl.searchParams.get("business")).toBe("business fixture/01");
    expect(planUrl.searchParams.get("goal")).toBe("net_profit");
    expect(planUrl.searchParams.get("value")).toBe("50000");
    expect(planUrl.searchParams.get("step")).toBe("plan");

    await planLink.click();
    await expect(page.getByTestId("planner-step-plan")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("planner-step-plan")).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId("planner-step-assumptions")).toBeVisible();

    await page.goto(`${fixturePath}?step=unknown`);
    await expect(page.getByTestId("planner-step-goal")).toBeVisible();
    await expect(page.getByRole("link", { name: /١\. الهدف/ })).toHaveAttribute(
      "aria-current",
      "step",
    );

    expect(errors).toEqual([]);
  });

  test("goal submission lands on the explicit plan step and mobile stays overflow-safe", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?business=business-a&goal=revenue&step=goal`);

    const assumptionsLink = page.getByRole("link", { name: /٢\. الافتراضات/ });
    await assumptionsLink.focus();
    await expect(assumptionsLink).toBeFocused();

    await page.getByRole("textbox", { name: "القيمة" }).fill("75000");
    await page.getByRole("button", { name: "احسب الخطة" }).click();

    await expect(page).toHaveURL(/step=plan/);
    await expect(page).toHaveURL(/value=75000/);
    await expect(page.getByTestId("planner-step-plan")).toBeVisible();

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    await page.screenshot({
      path: "test-results/screenshots/target-planner-step-mobile-390.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
