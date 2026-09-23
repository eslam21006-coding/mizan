import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-analytics-url-state";

/** Collects browser errors so Analytics URL-state coverage also guards runtime health. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("CI-only Analytics URL state", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("preserves direct, refresh, Back, and period state across Analytics views", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto(
      `${fixturePath}?business=business%20fixture%2F01&month=2026-08&view=trends&period=ytd&start=2026-01&end=2026-08`,
    );

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("link", { name: /اتجاهات تاريخية/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("analytics-trends")).toBeVisible();
    await expect(page.getByTestId("analytics-period")).toHaveText("الفترة: ytd");

    const comparisonLink = page.getByRole("link", { name: /مقارنة شهرية/ });
    const comparisonHref = await comparisonLink.getAttribute("href");
    expect(comparisonHref).not.toBeNull();
    const comparisonUrl = new URL(comparisonHref!, "http://127.0.0.1:3000");
    expect(comparisonUrl.searchParams.get("business")).toBe("business fixture/01");
    expect(comparisonUrl.searchParams.get("month")).toBe("2026-08");
    expect(comparisonUrl.searchParams.get("view")).toBe("comparison");
    expect(comparisonUrl.searchParams.get("period")).toBe("ytd");
    expect(comparisonUrl.searchParams.get("start")).toBe("2026-01");
    expect(comparisonUrl.searchParams.get("end")).toBe("2026-08");

    await comparisonLink.click();
    await expect(page.getByTestId("analytics-comparison")).toBeVisible();
    await expect(page.getByTestId("analytics-period")).toHaveText("الفترة: ytd");

    await page.reload();
    await expect(page.getByTestId("analytics-comparison")).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId("analytics-trends")).toBeVisible();
    await expect(page.getByTestId("analytics-period")).toHaveText("الفترة: ytd");

    await page.goto(`${fixturePath}?view=unknown&period=custom&start=2026-06&end=2026-08`);
    await expect(page.getByTestId("analytics-comparison")).toBeVisible();
    await expect(page.getByRole("link", { name: /مقارنة شهرية/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    expect(errors).toEqual([]);
  });

  test("keeps Analytics local navigation usable without horizontal overflow at 390px RTL", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?view=trends&period=rolling3&month=2026-08`);

    const comparisonLink = page.getByRole("link", { name: /مقارنة شهرية/ });
    const trendsLink = page.getByRole("link", { name: /اتجاهات تاريخية/ });
    const [comparisonBox, trendsBox] = await Promise.all([
      comparisonLink.boundingBox(),
      trendsLink.boundingBox(),
    ]);
    expect(comparisonBox).not.toBeNull();
    expect(trendsBox).not.toBeNull();
    expect(Math.abs((comparisonBox?.y ?? 0) - (trendsBox?.y ?? 0))).toBeLessThanOrEqual(1);

    await comparisonLink.focus();
    await expect(comparisonLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("analytics-comparison")).toBeVisible();

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    await page.screenshot({
      path: "test-results/screenshots/analytics-url-state-mobile-390.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
