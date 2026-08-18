import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";

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
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(liveEmail);
  await page.getByLabel("كلمة المرور").fill(livePassword);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("Task 5 business onboarding", () => {
  test.skip(!liveEmail || !livePassword, "Requires live Mizan Supabase test credentials");

  test("creates a business through the Arabic RTL wizard on desktop and remains responsive", async ({
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

    await expect(page.getByText(businessName)).toBeVisible();
    await expect(page.getByText(/EGP/)).toBeVisible();
    await page.screenshot({ path: "test-results/screenshots/business-onboarding-review.png", fullPage: true });

    await page.getByRole("button", { name: "إنشاء البزنس" }).click();
    await expect(page).toHaveURL(/\/businesses\?status=created$/);
    await expect(page.getByRole("status")).toContainText("تم إنشاء البزنس");
    await expect(page.getByRole("heading", { name: businessName, level: 2 })).toBeVisible();

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
