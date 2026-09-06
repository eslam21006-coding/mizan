import { expect, test } from "@playwright/test";

test.describe("Decision Engine Top 3 UI", () => {
  test("renders at most three deterministic observations in Arabic RTL without mobile overflow", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto("/auth/e2e-decision-insights");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const panel = page.getByRole("region", { name: "أهم 3 ملاحظات" });
    await expect(panel).toBeVisible();
    await expect(panel.locator("ol > li")).toHaveCount(3);
    await expect(panel.getByText("النمو الحالي يضغط على الربح")).toBeVisible();
    await expect(panel.getByText("الضغط يأتي من تكاليف خارج الميديا")).toBeVisible();
    await expect(panel.getByText("الحضور هو الاختناق الأوضح في الفانل")).toBeVisible();
    await expect(panel.getByText("التكلفة الكاملة للبزنس لكل عميل جديد", { exact: false })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    await expect(panel).toBeVisible();
    expect(browserErrors).toEqual([]);
  });

  test("shows the locked insufficient-data fallback instead of inventing a conclusion", async ({ page }) => {
    await page.goto("/auth/e2e-decision-insights?state=insufficient");

    const panel = page.getByRole("region", { name: "أهم 3 ملاحظات" });
    await expect(panel.locator("ol > li")).toHaveCount(0);
    await expect(panel.getByRole("status")).toContainText("البيانات غير كافية للحكم");
    await expect(panel.getByRole("status")).toContainText("لا يخترع تفسيرًا");
  });
});
