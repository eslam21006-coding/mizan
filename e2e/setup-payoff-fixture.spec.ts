import { expect, test } from "@playwright/test";

const enabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixture = "/auth/e2e-setup-payoff";
const businessId = "00000000-0000-4000-8000-000000000146";

function browserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("B11.3 first result screen", () => {
  test.skip(!enabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("renders exactly four Arabic metrics in order with known totals and exact-month CTAs", async ({ page }) => {
    const errors = browserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(fixture);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "جاهز — ميزان فهم البزنس", level: 1 })).toBeVisible();
    await expect(page.getByText("أكاديمية ميزان للتجربة")).toBeVisible();
    await expect(page.getByText(/سبتمبر/)).toBeVisible();

    const section = page.getByRole("region", { name: "المؤشرات المالية الأربعة للشهر" });
    const cards = section.getByRole("article");
    await expect(cards).toHaveCount(4);
    const expected = [
      ["صافي التحصيل", "١٠٬٠٠٠ USD"],
      ["صافي الربح الحقيقي", "٤٬٥٠٠ USD"],
      ["هامش صافي الربح الحقيقي", "٤٥٪"],
      ["التكلفة الكاملة للبزنس لكل عميل جديد", "٥٠٠ USD"],
    ];
    for (const [index, [heading, amount]] of expected.entries()) {
      await expect(cards.nth(index).getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(cards.nth(index).getByText(amount, { exact: true })).toBeVisible();
    }
    await expect(cards.last().getByText(/مؤشر خاص بميزان/)).toBeVisible();

    const nav = page.getByRole("navigation", { name: "الانتقال من نتيجة الإعداد" });
    const openDashboard = nav.getByRole("link", { name: "افتح لوحة البزنس" });
    const reviewMonth = nav.getByRole("link", { name: "مراجعة أرقام الشهر" });
    await expect(openDashboard).toHaveAttribute("href", `/businesses/${businessId}`);
    await expect(reviewMonth).toHaveAttribute("href", `/businesses/${businessId}/monthly?month=2026-09`);
    await openDashboard.focus();
    await expect(openDashboard).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(reviewMonth).toBeFocused();
    await page.screenshot({ path: "test-results/screenshots/b11-payoff-desktop.png", fullPage: true });
    expect(errors).toEqual([]);
  });

  test("preserves accurate unavailable explanations, negative amounts, and 390px RTL layout", async ({ page }) => {
    const errors = browserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixture}?case=zero-customers`);
    const region = page.getByRole("region", { name: "المؤشرات المالية الأربعة للشهر" });
    const cards = region.getByRole("article");
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(3).getByText("—", { exact: true })).toBeVisible();
    await expect(cards.nth(3).getByText("لا يمكن حساب التكلفة لكل عميل جديد لأن عدد العملاء الجدد صفر.")).toBeVisible();
    await expect(cards.nth(0).getByText("١٠٬٠٠٠ USD")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.goto(`${fixture}?case=zero-cash`);
    await expect(region.getByRole("article").nth(1).getByText("-٥٬٥٠٠ USD")).toBeVisible();
    await expect(region.getByRole("article").nth(2).getByText("—", { exact: true })).toBeVisible();
    await expect(region.getByRole("article").nth(2).getByText("لا يمكن حساب هامش الربح لأن صافي التحصيل صفر.")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.goto(`${fixture}?case=loss`);
    await expect(region.getByRole("article").nth(1).getByText("-٣٬٥٠٠ EGP")).toBeVisible();
    await expect(region.getByRole("article").nth(2).getByText("-١٧٥٪")).toBeVisible();
    await expect(page.getByRole("link", { name: "افتح لوحة البزنس" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.screenshot({ path: "test-results/screenshots/b11-payoff-mobile-loss.png", fullPage: true });
    expect(errors).toEqual([]);
  });
});
