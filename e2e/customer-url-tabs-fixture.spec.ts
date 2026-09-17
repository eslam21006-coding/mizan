import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-customer-tabs";

/** Collects console and uncaught page errors so Customer navigation tests fail on browser noise. */
function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

function tab(page: import("@playwright/test").Page, name: RegExp) {
  return page.getByRole("tab", { name });
}

test.describe("CI-only URL-backed Customer tabs fixture", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("preserves direct, refresh, Back, and safe fallback Customer view state", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto(`${fixturePath}?view=profitability&month=2026-08`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(tab(page, /ربحية العميل/)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fixture-profitability")).toBeVisible();
    await expect(page.getByTestId("fixture-overview")).toBeHidden();

    const customersTab = tab(page, /سجل العملاء/);
    await expect(customersTab).toHaveAttribute(
      "href",
      "/businesses/business%20fixture%2F01/customers?view=customers&month=2026-08",
    );

    await page.reload();
    await expect(tab(page, /ربحية العميل/)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fixture-profitability")).toBeVisible();

    await page.goto(`${fixturePath}?view=customers&month=2026-08`);
    await expect(tab(page, /سجل العملاء/)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fixture-customers")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${fixturePath}\\?view=profitability&month=2026-08$`));
    await expect(tab(page, /ربحية العميل/)).toHaveAttribute("aria-selected", "true");

    await page.goto(`${fixturePath}?view=unknown`);
    await expect(tab(page, /نظرة عامة/)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fixture-overview")).toBeVisible();

    await page.goto(fixturePath);
    await expect(tab(page, /نظرة عامة/)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fixture-overview")).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("keeps RTL keyboard order and five Customer views usable at 390px", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?view=overview&month=2026-08`);

    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(5);
    await expect(tab(page, /نظرة عامة/)).toHaveAttribute("aria-selected", "true");

    await expect(tab(page, /متوسط ما دفعه العميل/)).toHaveAttribute(
      "href",
      "/businesses/business%20fixture%2F01/customers?view=value&month=2026-08",
    );

    await tabs.evaluateAll((elements) => {
      for (const element of elements) {
        element.addEventListener("click", (event) => event.preventDefault());
      }
    });
    const overviewTab = tab(page, /نظرة عامة/);
    const valueTab = tab(page, /متوسط ما دفعه العميل/);
    await overviewTab.focus();
    await expect(overviewTab).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(valueTab).toBeFocused();

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    await page.screenshot({
      path: "test-results/screenshots/customer-url-tabs-mobile-390.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
