import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const BUSINESS_ID = "123e4567-e89b-42d3-a456-426614174000";
const MONTH = "2026-09";

/** Collects browser-visible failures across the complete N71 Funnel workflow. */
function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Requires each Funnel workflow stage to fit the mobile RTL viewport. */
async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

/** Redirects production-shaped Funnel destinations back into the authenticated N71 fixture. */
async function installFunnelJourneyRedirects(page: Page) {
  await page.route(`**/businesses/${BUSINESS_ID}/funnels**`, async (route) => {
    const url = new URL(route.request().url());
    const isMonthly = url.pathname.endsWith("/funnels/monthly");
    const isStructure = url.pathname.endsWith("/funnels");

    if (!isMonthly && !isStructure) {
      await route.continue();
      return;
    }

    const fixtureUrl = new URL("/auth/e2e-funnel-module", url.origin);
    fixtureUrl.searchParams.set("journey", "1");
    fixtureUrl.searchParams.set("tab", isMonthly ? "monthly" : "structure");
    for (const [key, value] of url.searchParams) {
      fixtureUrl.searchParams.append(key, value);
    }
    await route.continue({ url: fixtureUrl.toString() });
  });

  await page.route(`**/businesses/${BUSINESS_ID}/liquidation?**`, async (route) => {
    const url = new URL(route.request().url());
    const fixtureUrl = new URL("/auth/e2e-funnel-module", url.origin);
    fixtureUrl.searchParams.set("journey", "1");
    fixtureUrl.searchParams.set("tab", "liquidation");
    for (const [key, value] of url.searchParams) {
      fixtureUrl.searchParams.append(key, value);
    }
    await route.continue({ url: fixtureUrl.toString() });
  });
}

test.describe("N71 Funnel workflow journey", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("keeps Structure, Monthly, Return, Liquidation, and exact-month fix in one coherent workflow", async ({
    page,
  }) => {
    const browserErrors = collectBrowserErrors(page);
    await installFunnelJourneyRedirects(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(
      `/auth/e2e-funnel-module?journey=1&tab=structure&month=${MONTH}`,
    );

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الفانلز" })).toBeVisible();

    const createTrigger = page.getByRole("button", { name: "إضافة فانل" });
    await createTrigger.click();
    const createDialog = page.getByRole("dialog", { name: "إضافة فانل جديدة" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByRole("button", { name: "إلغاء" }).click();
    await expect(createDialog).toBeHidden();

    const editTrigger = page.getByRole("button", {
      name: "تعديل الفانل ويبينار البرنامج الأساسي",
    });
    await editTrigger.click();
    const editDialog = page.getByRole("dialog", {
      name: "تعديل ويبينار البرنامج الأساسي",
    });
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole("button", { name: "إلغاء" }).click();
    await expect(editDialog).toBeHidden();
    await expectNoHorizontalOverflow(page);

    const monthlyTab = page.getByRole("link", { name: "الأداء الشهري" });
    await expect(monthlyTab).toHaveAttribute(
      "href",
      `/businesses/${BUSINESS_ID}/funnels/monthly?month=${MONTH}&origin=funnel-structure`,
    );
    await monthlyTab.click();

    await expect(page.getByRole("heading", { name: "أرقام الفانلز الشهرية" })).toBeVisible();
    await expect(page.getByText(MONTH, { exact: true })).toBeVisible();
    const returnBanner = page.getByRole("region", {
      name: "سياق العودة من أرقام الفانلز الشهرية",
    });
    const returnToStructure = returnBanner.getByRole("link", {
      name: "العودة إلى هيكل الفانلز",
    });
    await expect(returnToStructure).toHaveAttribute(
      "href",
      `/businesses/${BUSINESS_ID}/funnels?month=${MONTH}`,
    );
    await expectNoHorizontalOverflow(page);

    await returnToStructure.click();

    await expect(page.getByRole("heading", { name: "الفانلز" })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe(MONTH);
    const liquidationTab = page.getByRole("link", { name: "تسييل الإنفاق" });
    await expect(liquidationTab).toHaveAttribute(
      "href",
      `/businesses/${BUSINESS_ID}/liquidation?month=${MONTH}`,
    );
    await liquidationTab.click();

    await expect(page.getByRole("heading", { name: "تسييل الإنفاق الإعلاني" })).toBeVisible();
    const missingData = page.getByRole("region", {
      name: "بيانات ناقصة لتحليل التسييل",
    });
    const fixAdSpend = missingData.getByRole("link", { name: "فتح أرقام الفانلز" });
    await expect(fixAdSpend).toHaveAttribute(
      "href",
      `/businesses/${BUSINESS_ID}/funnels/monthly?month=${MONTH}`,
    );
    await expectNoHorizontalOverflow(page);

    await fixAdSpend.click();

    await expect(page.getByRole("heading", { name: "أرقام الفانلز الشهرية" })).toBeVisible();
    await expect(page.getByText(MONTH, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "سياق العودة من أرقام الفانلز الشهرية" }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "الأداء الشهري" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectNoHorizontalOverflow(page);

    expect(browserErrors).toEqual([]);
  });
});
