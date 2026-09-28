import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-business-setup";
const businessId = "123e4567-e89b-42d3-a456-426614174000";
const productionBase = `/businesses/${businessId}/setup`;

function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function expectStableRtl(page: Page) {
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

async function routeProductionSetupToFixture(page: Page, fixtureCase: string) {
  await page.route("**/businesses/**/setup**", async (route) => {
    const requested = new URL(route.request().url());
    if (!requested.pathname.endsWith("/setup")) {
      await route.continue();
      return;
    }

    const fixture = new URL(fixturePath, requested.origin);
    fixture.searchParams.set("case", fixtureCase);
    const step = requested.searchParams.get("step");
    if (step) fixture.searchParams.set("step", step);
    await route.continue({ url: fixture.toString() });
  });
}

test.describe("B04 business setup shell", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows canonical 1/4 resume state and gates Next on incomplete revenue", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=empty&step=revenue`);

    await expect(page.getByRole("heading", { name: "أكمل إعداد البزنس" })).toBeVisible();
    await expect(page.getByText("1 من 4 خطوات مكتملة", { exact: true })).toBeVisible();

    const revenueStep = page.getByRole("link").filter({ hasText: "كيف يدخل المال؟" });
    await expect(revenueStep).toHaveAttribute("aria-current", "step");
    await expect(page.getByText("التالي", { exact: true }).last()).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("keeps out-of-order progress factual while resume still targets the first missing step", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?case=out-of-order&step=revenue`);

    await expect(page.getByText("3 من 4 خطوات مكتملة", { exact: true })).toBeVisible();
    await expect(page.getByRole("link").filter({ hasText: "كيف يدخل المال؟" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(page.getByRole("link").filter({ hasText: "أين يذهب المال؟" })).toContainText(
      "مكتملة",
    );
    await expect(page.getByRole("link").filter({ hasText: "أول شهر حقيقي" })).toContainText(
      "مكتملة",
    );
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("preserves copied deep URLs through refresh, Back, and Forward", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await routeProductionSetupToFixture(page, "complete");

    const revenueUrl = `${productionBase}?step=revenue`;
    const expensesUrl = `${productionBase}?step=expenses`;
    await page.goto(revenueUrl);
    await expect(page.getByRole("link").filter({ hasText: "كيف يدخل المال؟" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    await page.reload();
    await expect(page.getByRole("link").filter({ hasText: "كيف يدخل المال؟" })).toHaveAttribute(
      "aria-current",
      "step",
    );

    await page.getByRole("link").filter({ hasText: "أين يذهب المال؟" }).click();
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      expensesUrl,
    );
    await expect(page.getByRole("link").filter({ hasText: "أين يذهب المال؟" })).toHaveAttribute(
      "aria-current",
      "step",
    );

    await page.goBack();
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      revenueUrl,
    );
    await page.goForward();
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      expensesUrl,
    );
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("renders the structural completion view without financial payoff metrics", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=complete`);

    await expect(page.getByRole("heading", { name: "إعداد البزنس مكتمل" })).toBeVisible();
    await expect(page.getByText("4 من 4 خطوات مكتملة", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "فتح البزنس" })).toBeVisible();
    await expect(page.getByText("Real Net Profit")).toHaveCount(0);
    await expect(page.getByText("Ultimate CAC")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("fails closed when readiness facts cannot be loaded", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=load-error&step=expenses`);

    await expect(page.getByRole("alert")).toContainText("تعذر تحميل حالة إعداد البزنس");
    await expect(page.getByText("حالة التقدم غير متاحة", { exact: true })).toBeVisible();
    await expect(page.getByText(/من 4 خطوات مكتملة/)).toHaveCount(0);
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });
});
