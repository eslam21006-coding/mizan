import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(liveEmail);
  await page.getByLabel("كلمة المرور").fill(livePassword);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("formerly-placeholder navigation destinations", () => {
  test.skip(!liveEmail || !livePassword, "Requires live Mizan Supabase test credentials");

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("monthly, target planner, and settings are real Arabic RTL destinations", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const routes = [
      { path: "/monthly", heading: "الأرقام الشهرية" },
      { path: "/target-plan", heading: "خطة الوصول للهدف" },
      { path: "/settings", heading: "الإعدادات" },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();
      await expect(page.getByText(/هذه المساحة جاهزة داخل هيكل التطبيق/)).toHaveCount(0);

      const dimensions = await page.locator("html").evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(dimensions.scrollWidth, `horizontal overflow on ${route.path}`).toBeLessThanOrEqual(
        dimensions.clientWidth + 1,
      );
    }
  });
});
