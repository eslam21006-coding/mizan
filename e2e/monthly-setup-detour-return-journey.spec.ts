import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const BUSINESS_ID = "00000000-0000-4000-8000-000000000025";

/** Collects browser-visible failures across the full setup detour journey. */
function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Requires the current journey stage to fit the mobile viewport without horizontal scrolling. */
async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

/** Redirects production-shaped Monthly setup links into authenticated fixtures while preserving query state. */
async function installMonthlySetupJourneyRedirects(page: Page) {
  for (const routeName of ["revenue-streams", "expenses"] as const) {
    await page.route(`**/businesses/${BUSINESS_ID}/${routeName}?**`, async (route) => {
      const url = new URL(route.request().url());
      const fixtureUrl = new URL("/auth/e2e-setup-return", url.origin);
      fixtureUrl.searchParams.set("businessId", BUSINESS_ID);
      if (routeName === "expenses") fixtureUrl.searchParams.set("target", "expenses");
      for (const [key, value] of url.searchParams) {
        fixtureUrl.searchParams.append(key, value);
      }
      await route.continue({ url: fixtureUrl.toString() });
    });
  }

  await page.route(`**/businesses/${BUSINESS_ID}/monthly?**`, async (route) => {
    const url = new URL(route.request().url());
    await route.continue({ url: `${url.origin}/auth/e2e-monthly-entry${url.search}` });
  });
}

test.describe("N69 Monthly setup detour/return journey", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("preserves the Monthly month and upstream profitability context through both setup detours", async ({
    page,
  }) => {
    const browserErrors = collectBrowserErrors(page);
    await installMonthlySetupJourneyRedirects(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const monthlyPath =
      "/auth/e2e-monthly-entry?month=2026-09&origin=customer-profitability&return_month=2026-07";
    const exactMonthlyReturn =
      `/businesses/${BUSINESS_ID}/monthly?month=2026-09&origin=customer-profitability&return_month=2026-07`;
    const exactProfitabilityReturn =
      `/businesses/${BUSINESS_ID}/customers?view=profitability&month=2026-07`;

    await page.goto(monthlyPath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("سبتمبر ٢٠٢٦", { exact: true })).toBeVisible();

    const monthlyReturnBanner = page.getByRole("region", {
      name: "سياق العودة من الإدخال الشهري",
    });
    await expect(
      monthlyReturnBanner.getByRole("link", { name: "العودة إلى ربحية العميل" }),
    ).toHaveAttribute("href", exactProfitabilityReturn);

    const revenueSetupHref =
      `/businesses/${BUSINESS_ID}/revenue-streams?origin=monthly-editor&month=2026-09&upstream_origin=customer-profitability&upstream_month=2026-07`;
    const expenseSetupHref =
      `/businesses/${BUSINESS_ID}/expenses?origin=monthly-editor&month=2026-09&upstream_origin=customer-profitability&upstream_month=2026-07`;

    const revenueLink = page.getByRole("link", { name: "إدارة مصادر الإيراد" });
    await expect(revenueLink).toHaveAttribute("href", revenueSetupHref);
    await expectNoHorizontalOverflow(page);

    await revenueLink.click();

    await expect(page.getByRole("heading", { name: "مصادر الإيراد" })).toBeVisible();
    const revenueReturnBanner = page.getByRole("region", {
      name: "سياق العودة من إعداد مصادر الإيراد",
    });
    const revenueReturn = revenueReturnBanner.getByRole("link", {
      name: "العودة إلى الإدخال الشهري",
    });
    await expect(revenueReturn).toHaveAttribute("href", exactMonthlyReturn);
    await expectNoHorizontalOverflow(page);

    await revenueReturn.click();

    await expect(page.getByRole("heading", { name: "الإدخال الشهري" })).toBeVisible();
    await expect(page.getByText("سبتمبر ٢٠٢٦", { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "سياق العودة من الإدخال الشهري" })
        .getByRole("link", { name: "العودة إلى ربحية العميل" }),
    ).toHaveAttribute("href", exactProfitabilityReturn);

    const expenseLink = page.getByRole("link", { name: "إدارة هيكل المصروفات" });
    await expect(expenseLink).toHaveAttribute("href", expenseSetupHref);
    await expectNoHorizontalOverflow(page);

    await expenseLink.click();

    await expect(page.getByRole("heading", { name: "هيكل المصروفات" })).toBeVisible();
    const expenseReturnBanner = page.getByRole("region", {
      name: "سياق العودة من إعداد المصروفات",
    });
    const expenseReturn = expenseReturnBanner.getByRole("link", {
      name: "العودة إلى الإدخال الشهري",
    });
    await expect(expenseReturn).toHaveAttribute("href", exactMonthlyReturn);
    await expectNoHorizontalOverflow(page);

    await expenseReturn.click();

    await expect(page.getByRole("heading", { name: "الإدخال الشهري" })).toBeVisible();
    await expect(page.getByText("سبتمبر ٢٠٢٦", { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "سياق العودة من الإدخال الشهري" })
        .getByRole("link", { name: "العودة إلى ربحية العميل" }),
    ).toHaveAttribute("href", exactProfitabilityReturn);
    await expectNoHorizontalOverflow(page);

    expect(browserErrors).toEqual([]);
  });
});
