import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const customerTabsPath = "/auth/e2e-customer-tabs";
const navigationFoundationPath = "/auth/e2e-navigation-foundation";

/** Collects console and uncaught page errors for one browser page. */
function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Requires Arabic RTL and a viewport without page-level horizontal overflow. */
async function expectStableMobileShell(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

/** Returns the exact app-relative path, query, and hash for comparison across navigation events. */
function relativeUrl(page: Page) {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}${url.hash}`;
}

test.describe("N72 global navigation regression", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("preserves copied URL state through direct load, refresh, navigation, and browser Back", async ({
    page,
  }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const copiedProfitabilityUrl =
      `${customerTabsPath}?view=profitability&month=2026-08`;
    await page.goto(copiedProfitabilityUrl);
    await expectStableMobileShell(page);

    const profitabilityTab = page.getByRole("tab", { name: /ربحية العميل/ });
    const customersTab = page.getByRole("tab", { name: /سجل العملاء/ });
    await expect(profitabilityTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fixture-profitability")).toBeVisible();
    expect(relativeUrl(page)).toBe(copiedProfitabilityUrl);

    await customersTab.click();
    const customersUrl = `${customerTabsPath}?view=customers&month=2026-08`;
    await expect.poll(() => relativeUrl(page)).toBe(customersUrl);
    await expect(customersTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fixture-customers")).toBeVisible();

    await page.reload();
    await expect.poll(() => relativeUrl(page)).toBe(customersUrl);
    await expect(customersTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fixture-customers")).toBeVisible();

    await page.goBack();
    await expect.poll(() => relativeUrl(page)).toBe(copiedProfitabilityUrl);
    await expect(profitabilityTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fixture-profitability")).toBeVisible();

    await page.goto(customerTabsPath);
    await expect(page.getByRole("tab", { name: /نظرة عامة/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.goto(copiedProfitabilityUrl);
    await expect.poll(() => relativeUrl(page)).toBe(copiedProfitabilityUrl);
    await expect(profitabilityTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("fixture-profitability")).toBeVisible();
    await expectStableMobileShell(page);

    expect(errors).toEqual([]);
  });

  test("keeps breadcrumb hierarchy, Back/Return semantics, and recoverable errors stable at 390px", async ({
    page,
  }) => {
    const errors = collectBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(navigationFoundationPath);
    await expectStableMobileShell(page);

    const breadcrumb = page.getByRole("navigation", { name: "مسار التنقل" });
    const businessesLink = breadcrumb.getByRole("link", { name: "البزنسات" });
    const businessLink = breadcrumb.getByRole("link", { name: "أكاديمية ميزان" });
    const currentCrumb = breadcrumb.getByText("اقتصاديات العملاء", { exact: true });
    const expectedBusinessOverview = "/?business=business+fixture%2F01";
    const expectedWorkflowReturn =
      "/businesses/business%20fixture%2F01/customers?view=profitability&month=2026-08";

    await expect(breadcrumb).toBeVisible();
    await expect(businessesLink).toHaveAttribute("href", "/businesses");
    await expect(businessLink).toHaveAttribute("href", expectedBusinessOverview);
    await expect(currentCrumb).toHaveAttribute("aria-current", "page");

    const backLink = page.getByRole("link", { name: "العودة إلى البزنس" });
    const returnBanner = page.getByRole("region", { name: "سياق العودة" });
    const returnLink = returnBanner.getByRole("link", { name: "العودة إلى ربحية العميل" });
    await expect(backLink).toHaveAttribute("href", expectedBusinessOverview);
    await expect(returnLink).toHaveAttribute("href", expectedWorkflowReturn);
    expect(await backLink.getAttribute("href")).not.toBe(await returnLink.getAttribute("href"));

    const errorState = page.getByRole("alert", { name: "تعذر تحميل تفاصيل المراجعة" });
    const retryLink = errorState.getByRole("link", { name: "إعادة المحاولة" });
    const errorReturn = errorState.getByRole("link", { name: "العودة إلى ربحية العميل" });
    await expect(errorState).toBeVisible();
    await expect(errorState.getByRole("heading", { name: "تعذر تحميل تفاصيل المراجعة" })).toBeVisible();
    await expect(retryLink).toHaveAttribute("href", navigationFoundationPath);
    await expect(errorReturn).toHaveAttribute("href", expectedWorkflowReturn);

    await retryLink.focus();
    await expect(retryLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(errorReturn).toBeFocused();

    await page.reload();
    await expectStableMobileShell(page);
    await expect(page.getByRole("navigation", { name: "مسار التنقل" })).toBeVisible();
    await expect(page.getByRole("link", { name: "العودة إلى البزنس" })).toHaveAttribute(
      "href",
      expectedBusinessOverview,
    );
    await expect(
      page
        .getByRole("alert", { name: "تعذر تحميل تفاصيل المراجعة" })
        .getByRole("link", { name: "العودة إلى ربحية العميل" }),
    ).toHaveAttribute("href", expectedWorkflowReturn);

    expect(errors).toEqual([]);
  });
});
