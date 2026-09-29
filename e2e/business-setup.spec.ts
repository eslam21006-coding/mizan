import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-business-setup";
const businessId = "123e4567-e89b-42d3-a456-426614174000";
const productionBase = `/businesses/${businessId}/setup`;
const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const liveInviteTokenHash = process.env.MIZAN_E2E_INVITE_TOKEN_HASH?.trim() ?? "";
const hasLiveAuth = Boolean(liveInviteTokenHash || (liveEmail && livePassword));

/** Collects console and uncaught browser errors for one setup scenario. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Verifies Arabic RTL and absence of page-level horizontal overflow. */
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

/** Signs into a live Mizan environment when B06 end-to-end credentials are available. */
async function login(page: Page) {
  if (liveInviteTokenHash) {
    await page.goto(
      `/auth/confirm?token_hash=${encodeURIComponent(liveInviteTokenHash)}&type=invite`,
    );
    await expect(page).toHaveURL(/\/set-password$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    return;
  }

  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(liveEmail);
  await page.getByLabel("كلمة المرور").fill(livePassword);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Serves fixture HTML for production-shaped setup URLs while preserving the browser URL. */
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

    const response = await route.fetch({ url: fixture.toString() });
    await route.fulfill({ response });
  });
}

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test.describe("B04 business setup shell", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows canonical 1/4 resume state and gates Next on incomplete revenue", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=empty&step=revenue`);

    await expect(page.getByRole("heading", { name: "أكمل إعداد البزنس" })).toBeVisible();
    await expect(page.getByText("1 من 4 خطوات مكتملة", { exact: true })).toBeVisible();

    const revenueStep = page.getByRole("link").filter({ hasText: "كيف يدخل المال؟" });
    await expect(revenueStep).toHaveAttribute("aria-current", "step");
    await expect(page.getByRole("button", { name: "التالي" })).toBeDisabled();
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

    await expect(
      page.getByRole("alert").filter({ hasText: "تعذر تحميل حالة إعداد البزنس" }),
    ).toContainText("تعذر تحميل حالة إعداد البزنس");
    await expect(page.getByText("حالة التقدم غير متاحة", { exact: true })).toBeVisible();
    await expect(page.getByText(/من 4 خطوات مكتملة/)).toHaveCount(0);
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });
});


test.describe("B06 Money-In setup", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows the name-only Money-In form without advanced classification", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=empty&step=revenue`);

    await expect(
      page.getByRole("heading", { name: "ما الذي تبيعُه أو تحصل منه على إيراد؟" }),
    ).toBeVisible();
    await expect(page.getByLabel("اسم المنتج أو الخدمة")).toBeVisible();
    await expect(page.getByRole("button", { name: "إضافة مصدر الإيراد" })).toBeVisible();
    await expect(page.getByText("Front-End")).toHaveCount(0);
    await expect(page.getByText("Backend")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "التالي" })).toBeDisabled();
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("inactive-only sources remain visible without completing Revenue", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=inactive-only&step=revenue`);

    await expect(page.getByText("عرض قديم", { exact: true })).toBeVisible();
    await expect(page.getByText("غير نشط", { exact: true })).toBeVisible();
    await expect(page.getByText("1 من 4 خطوات مكتملة", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "التالي" })).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test("multiple active sources keep Revenue complete and Next targets Expenses at 390px", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await routeProductionSetupToFixture(page, "multiple");
    await page.goto(`${productionBase}?step=revenue`);

    await expect(page.getByText("2 من 4 خطوات مكتملة", { exact: true })).toBeVisible();
    await expect(page.getByText("الكورس الأساسي", { exact: true })).toBeVisible();
    await expect(page.getByText("VIP", { exact: true })).toBeVisible();
    await expect(page.getByText("Mastermind", { exact: true })).toBeVisible();

    const next = page.getByRole("link", { name: "التالي" });
    await expect(next).toHaveAttribute(
      "href",
      `/businesses/${businessId}/setup?step=expenses`,
    );
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("read-only members can inspect sources without mutation controls", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=revenue&step=revenue`);

    await expect(page.getByText("الكورس الأساسي", { exact: true })).toBeVisible();
    await expect(page.getByText("عرض فقط", { exact: true })).toBeVisible();
    await expect(page.getByLabel("اسم المنتج أو الخدمة")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "إضافة مصدر الإيراد" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe("B06 live Money-In handoff", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("adds Revenue in setup, stays on Revenue, then advances explicitly to Expenses", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    const suffix = Date.now();
    const businessName = `بزنس B06 ${suffix}`;
    const firstSource = `الكورس الأساسي ${suffix}`;
    const secondSource = `VIP ${suffix}`;

    await login(page);
    await page.goto("/businesses/new");
    await page.getByLabel("اسم البزنس").fill(businessName);
    await page.getByRole("button", { name: /EGP/ }).click();
    await page.getByRole("button", { name: "إنشاء البزنس والمتابعة" }).click();
    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]+\/setup\?step=revenue$/);
    await expect(page.getByText("1 من 4 خطوات مكتملة", { exact: true })).toBeVisible();

    await page.getByLabel("اسم المنتج أو الخدمة").fill(firstSource);
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
    await expect(page).toHaveURL(
      /\/businesses\/[0-9a-f-]+\/setup\?step=revenue&status=created$/,
    );
    await expect(page.getByText(firstSource, { exact: true })).toBeVisible();
    await expect(page.getByText("2 من 4 خطوات مكتملة", { exact: true })).toBeVisible();

    await page.getByLabel("اسم المنتج أو الخدمة").fill(secondSource);
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
    await expect(page.getByText(secondSource, { exact: true })).toBeVisible();
    await expect(page.getByText("2 من 4 خطوات مكتملة", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "التالي" }).click();
    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]+\/setup\?step=expenses$/);
    expect(errors).toEqual([]);
  });
});
