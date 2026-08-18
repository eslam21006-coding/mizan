import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const liveInviteTokenHash = process.env.MIZAN_E2E_INVITE_TOKEN_HASH?.trim() ?? "";
const hasLiveAuth = Boolean(liveInviteTokenHash || (liveEmail && livePassword));

function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function login(page: import("@playwright/test").Page) {
  if (liveInviteTokenHash) {
    await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(liveInviteTokenHash)}&type=invite`);
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

test.describe("Task 5 business onboarding", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("creates exactly one business through the Arabic RTL wizard and remains responsive", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    const businessName = `بزنس اختبار ${Date.now()}`;

    await login(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/businesses/new");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "أضف بزنس جديد", level: 1 })).toBeVisible();

    await page.getByLabel("اسم البزنس").fill(businessName);
    await page.getByLabel("اسم البزنس").press("Enter");
    await expect(page.getByRole("button", { name: /EGP/ })).toBeVisible();

    await page.getByRole("button", { name: /EGP/ }).click();
    await page.getByRole("button", { name: "التالي" }).click();

    await page.getByLabel("المنطقة الزمنية").selectOption("Africa/Cairo");
    await page.getByRole("button", { name: "التالي" }).click();

    await expect(page).toHaveURL(/\/businesses\/new$/);
    await expect(page.getByText(businessName)).toBeVisible();
    await expect(page.getByText(/EGP/)).toBeVisible();
    const submitButton = page.getByRole("button", { name: "إنشاء البزنس" });
    await expect(submitButton).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/business-onboarding-review.png", fullPage: true });

    await submitButton.dispatchEvent("click");
    await expect(page).toHaveURL(/\/businesses\?status=created$/);
    await expect(page.getByRole("status")).toContainText("تم إنشاء البزنس");

    const createdBusinessHeadings = page.getByRole("heading", { name: businessName, level: 2 });
    await expect(createdBusinessHeadings).toHaveCount(1);
    await expect(createdBusinessHeadings).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/businesses/new");
    await expect(page.getByRole("heading", { name: "أضف بزنس جديد", level: 1 })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      )
      .toBe(true);
    await page.screenshot({ path: "test-results/screenshots/business-onboarding-mobile.png", fullPage: true });

    expect(errors).toEqual([]);
  });
});
