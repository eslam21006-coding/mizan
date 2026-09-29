import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-business-onboarding";
const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const liveInviteTokenHash = process.env.MIZAN_E2E_INVITE_TOKEN_HASH?.trim() ?? "";
const hasLiveAuth = Boolean(liveInviteTokenHash || (liveEmail && livePassword));

/** Collects console and uncaught browser errors for creation-flow verification. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Verifies Arabic RTL and page-level responsive overflow. */
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

/** Signs into a live Mizan environment when credentials are available. */
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

test.describe("B05 simplified business creation UI", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows one-screen identity fields with secondary editable timezone", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(fixturePath);

    await expect(page.getByRole("heading", { name: "المعلومات الأساسية فقط" })).toBeVisible();
    await expect(page.getByLabel("اسم البزنس")).toBeVisible();
    await expect(page.getByRole("button", { name: /EGP/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "التالي" })).toHaveCount(0);
    await expect(page.getByText("راجع البيانات")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "إنشاء البزنس والمتابعة" })).toBeVisible();

    const changeTimezone = page.getByRole("button", { name: "تغيير" });
    if (await changeTimezone.isVisible().catch(() => false)) {
      await changeTimezone.click();
    }
    await expect(page.getByLabel("المنطقة الزمنية")).toBeVisible();
    await page.getByLabel("المنطقة الزمنية").selectOption("Africa/Cairo");
    await expect(page.getByRole("button", { name: "تم" })).toBeVisible();

    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("remains usable at 390px without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    await expect(page.getByLabel("اسم البزنس")).toBeVisible();
    await expect(page.getByRole("button", { name: /USD/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "إنشاء البزنس والمتابعة" })).toBeVisible();
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });
});

test.describe("B05 live creation handoff", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("creates one business then enters B04 at canonical revenue setup", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    const businessName = `بزنس اختبار ${Date.now()}`;

    await login(page);
    await page.goto("/businesses/new");

    await page.getByLabel("اسم البزنس").fill(businessName);
    await page.getByRole("button", { name: /EGP/ }).click();

    const changeTimezone = page.getByRole("button", { name: "تغيير" });
    if (await changeTimezone.isVisible().catch(() => false)) {
      await changeTimezone.click();
    }
    await page.getByLabel("المنطقة الزمنية").selectOption("Africa/Cairo");

    await page.getByRole("button", { name: "إنشاء البزنس والمتابعة" }).click();

    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]+\/setup\?step=revenue$/);
    await expect(page.getByText("1 من 4 خطوات مكتملة", { exact: true })).toBeVisible();
    await expect(page.getByRole("link").filter({ hasText: "كيف يدخل المال؟" })).toHaveAttribute(
      "aria-current",
      "step",
    );

    await page.reload();
    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]+\/setup\?step=revenue$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/businesses\/new$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]+\/setup\?step=revenue$/);

    expect(errors).toEqual([]);
  });
});
