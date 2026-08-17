import { expect, test } from "@playwright/test";

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

test("unauthenticated protected routes redirect to Arabic RTL login", async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto("/monthly");

  await expect(page).toHaveURL(/\/login\?next=%2Fmonthly$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "مرحبًا بعودتك", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "دخول" })).toBeVisible();
  await expect(page.getByText("لا يوجد تسجيل حساب عام", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /تسجيل|إنشاء|signup/i })).toHaveCount(0);

  await page.screenshot({ path: "test-results/screenshots/login-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("invalid invite link returns to login without creating a session", async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto("/auth/confirm?type=invite");

  await expect(page).toHaveURL(/\/login\?error=invalid-invite$/);
  await expect(page.getByText("رابط الدعوة غير صالح", { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test("access denied screen is available without exposing application data", async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto("/access-denied");

  await expect(page.getByRole("heading", { name: "الحساب غير مصرح له", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "تسجيل الخروج" })).toBeVisible();
  await expect(page.locator(".desktop-sidebar")).toHaveCount(0);
  expect(errors).toEqual([]);
});
