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
      `${fixturePath}?view=customers&month=2026-08`,
    );

    await customersTab.click();
    await expect(page).toHaveURL(new RegExp(`${fixturePath}\\?view=customers&month=2026-08$`));
    await expect(tab(page, /سجل العملاء/)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fixture-customers")).toBeVisible();

    await page.reload();
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
    const tabList = page.getByRole("tablist", { name: "أقسام تحليل العملاء" });
    await expect(tabs).toHaveCount(5);
    await expect(tab(page, /نظرة عامة/)).toHaveAttribute("aria-selected", "true");

    const tabListMetrics = await tabList.evaluate((element) => ({
      position: getComputedStyle(element).position,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(tabListMetrics.position).toBe("sticky");
    expect(tabListMetrics.scrollWidth).toBeGreaterThan(tabListMetrics.clientWidth);

    await expect(tab(page, /متوسط ما دفعه العميل/)).toHaveAttribute(
      "href",
      `${fixturePath}?view=value&month=2026-08`,
    );

    const overviewTab = tab(page, /نظرة عامة/);
    await overviewTab.focus();
    await expect(overviewTab).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(new RegExp(`${fixturePath}\\?view=value&month=2026-08$`));
    await expect(tab(page, /متوسط ما دفعه العميل/)).toHaveAttribute("aria-selected", "true");

    await page.goto(`${fixturePath}?view=customers&month=2026-08`);
    const activeCustomerTab = tab(page, /سجل العملاء/);
    await expect(activeCustomerTab).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(async () => {
        const listBox = await tabList.boundingBox();
        const activeBox = await activeCustomerTab.boundingBox();
        if (!listBox || !activeBox) return false;
        return (
          activeBox.x >= listBox.x - 1 &&
          activeBox.x + activeBox.width <= listBox.x + listBox.width + 1
        );
      })
      .toBe(true);

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
