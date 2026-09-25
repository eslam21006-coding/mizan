import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const BUSINESS_ID = "123e4567-e89b-42d3-a456-426614174000";

/** Collects browser-visible failures across the full N70 historical correction journey. */
function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Requires the current journey stage to fit the 390px mobile viewport. */
async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

/** Redirects production-shaped Monthly/correction links into authenticated fixtures without altering query state. */
async function installHistoricalCorrectionJourneyRedirects(page: Page) {
  await page.route(
    `**/businesses/${BUSINESS_ID}/monthly/correction?**`,
    async (route) => {
      const url = new URL(route.request().url());
      const fixtureUrl = new URL("/auth/e2e-historical-month", url.origin);
      fixtureUrl.searchParams.set("stage", "journey-correction");
      for (const [key, value] of url.searchParams) {
        fixtureUrl.searchParams.append(key, value);
      }
      await route.continue({ url: fixtureUrl.toString() });
    },
  );

  await page.route(`**/businesses/${BUSINESS_ID}/monthly?**`, async (route) => {
    const url = new URL(route.request().url());
    const fixtureUrl = new URL("/auth/e2e-historical-month", url.origin);
    fixtureUrl.searchParams.set("stage", "journey-monthly");
    for (const [key, value] of url.searchParams) {
      fixtureUrl.searchParams.append(key, value);
    }
    await route.continue({ url: fixtureUrl.toString() });
  });
}

test.describe("N70 Historical correction journey", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("corrects an exact historical month and returns with upstream profitability context intact", async ({
    page,
  }) => {
    const browserErrors = collectBrowserErrors(page);
    await installHistoricalCorrectionJourneyRedirects(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const monthlyStart =
      "/auth/e2e-historical-month?stage=journey-monthly&month=2026-07&origin=customer-profitability&return_month=2026-06";
    const exactCorrectionHref =
      `/businesses/${BUSINESS_ID}/monthly/correction?month=2026-07&origin=customer-profitability&return_month=2026-06`;
    const exactMonthlyHref =
      `/businesses/${BUSINESS_ID}/monthly?month=2026-07&origin=customer-profitability&return_month=2026-06`;
    const exactSuccessHref =
      `/businesses/${BUSINESS_ID}/monthly?month=2026-07&status=corrected&origin=customer-profitability&return_month=2026-06`;
    const profitabilityHref =
      `/businesses/${BUSINESS_ID}/customers?view=profitability&month=2026-06`;

    await page.goto(monthlyStart);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الإدخال الشهري" })).toBeVisible();
    await expect(page.getByText("يوليو ٢٠٢٦", { exact: true })).toBeVisible();

    const historicalPanel = page.getByRole("region", { name: "حالة الشهر التاريخي" });
    await expect(historicalPanel).toContainText("شهر تاريخي");
    await expect(historicalPanel).toContainText("العرض هنا للرجوع والمراجعة فقط");

    const profitabilityReturn = page
      .getByRole("region", { name: "سياق العودة من رحلة التصحيح التاريخي" })
      .getByRole("link", { name: "العودة إلى ربحية العميل" });
    await expect(profitabilityReturn).toHaveAttribute("href", profitabilityHref);

    const correctionLink = historicalPanel.getByRole("link", { name: "بدء تصحيح تاريخي" });
    await expect(correctionLink).toHaveAttribute("href", exactCorrectionHref);
    await expectNoHorizontalOverflow(page);

    await correctionLink.click();

    await expect(page.getByRole("heading", { name: "تصحيح بيانات شهر سابق" })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2026-07");
    await expect.poll(() => new URL(page.url()).searchParams.get("origin")).toBe(
      "customer-profitability",
    );
    await expect.poll(() => new URL(page.url()).searchParams.get("return_month")).toBe(
      "2026-06",
    );

    const backLink = page.getByRole("link", { name: /العودة إلى يوليو/ });
    await expect(backLink).toHaveAttribute("href", exactMonthlyHref);
    await expect(
      page
        .getByRole("region", { name: "سياق العودة من رحلة التصحيح التاريخي" })
        .getByRole("link", { name: "العودة إلى ربحية العميل" }),
    ).toHaveAttribute("href", profitabilityHref);
    await expectNoHorizontalOverflow(page);

    const simulateSave = page.getByRole("link", { name: "محاكاة حفظ التصحيح التاريخي" });
    await expect(simulateSave).toHaveAttribute("href", exactSuccessHref);
    await simulateSave.click();

    await expect(page.getByRole("heading", { name: "الإدخال الشهري" })).toBeVisible();
    await expect(page.getByText("يوليو ٢٠٢٦", { exact: true })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2026-07");
    await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("corrected");
    await expect.poll(() => new URL(page.url()).searchParams.get("origin")).toBe(
      "customer-profitability",
    );
    await expect.poll(() => new URL(page.url()).searchParams.get("return_month")).toBe(
      "2026-06",
    );

    const success = page.getByRole("status", { name: "تأكيد التصحيح التاريخي" });
    await expect(success).toContainText("تم حفظ التصحيح التاريخي");
    await expect(success).toContainText("يوليو ٢٠٢٦");
    await expect(
      page
        .getByRole("region", { name: "سياق العودة من رحلة التصحيح التاريخي" })
        .getByRole("link", { name: "العودة إلى ربحية العميل" }),
    ).toHaveAttribute("href", profitabilityHref);

    const returnedHistoricalPanel = page.getByRole("region", { name: "حالة الشهر التاريخي" });
    await expect(returnedHistoricalPanel).toContainText("العرض هنا للرجوع والمراجعة فقط");
    await expect(
      returnedHistoricalPanel.getByRole("link", { name: "بدء تصحيح تاريخي" }),
    ).toHaveAttribute("href", exactCorrectionHref);
    await expectNoHorizontalOverflow(page);

    expect(browserErrors).toEqual([]);
  });
});
