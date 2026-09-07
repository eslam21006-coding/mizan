import { expect, test } from "@playwright/test";

test.describe("transaction import review clarity", () => {
  test("makes partial import, skipped rows, and persistence actions explicit without mobile overflow", async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/auth/e2e-transaction-import-clarity");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "المراجعة وحدها لا تحفظ أي معاملات" })).toBeVisible();
    await expect(page.getByText(/وجود صفوف غير صالحة لا يوقف باقي الملف/)).toBeVisible();
    await expect(page.getByText(/يستورد الصفوف السليمة فقط/)).toBeVisible();
    await expect(page.getByText(/لا يخمن مبلغًا مفقودًا ولا يحول عملة مختلفة/)).toBeVisible();
    await expect(page.getByText(/هذا هو الإجراء الذي يحفظ المعاملات فعلًا/)).toBeVisible();

    await expect(page.getByRole("link", { name: "اختيار ملف مصحح" })).toHaveAttribute(
      "href",
      "#transaction-file",
    );
    await expect(page.getByRole("link", { name: "العودة للمراجعة والحفظ" })).toHaveAttribute(
      "href",
      "#transaction-validation-title",
    );

    const hasWholePageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasWholePageOverflow).toBe(false);
    expect(browserErrors).toEqual([]);
  });
});
