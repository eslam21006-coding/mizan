import { expect, test } from "@playwright/test";

test.describe("verified transaction import completion", () => {
  test("shows database-verified saved rows, business totals, and the Customers & LTV next step", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto("/auth/e2e-transaction-import-completion");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const completion = page.getByRole("status");
    await expect(completion.getByRole("heading", { name: "تم حفظ معاملاتك والتحقق منها" })).toBeVisible();
    await expect(completion).toContainText("تحقق ميزان من وجود 9 معاملة جديدة في قاعدة البيانات");
    await expect(completion).toContainText("معاملات جديدة");
    await expect(completion).toContainText("مكررة مؤكدة");
    await expect(completion).toContainText("صفوف تفاصيل تم تجاهلها");
    await expect(completion).toContainText("صفوف غير صالحة");
    await expect(completion).toContainText("إجمالي المعاملات المحفوظة");
    await expect(completion).toContainText("1284");
    await expect(completion).toContainText("إجمالي العملاء المسجلين");
    await expect(completion).toContainText("436");
    await expect(completion).toContainText("USD 218750.4");

    const customerAnalysisLink = completion.getByRole("link", { name: "عرض تحليل العملاء" });
    await expect(customerAnalysisLink).toHaveAttribute(
      "href",
      "/businesses/fixture-business/customers",
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    await expect(customerAnalysisLink).toBeVisible();
    expect(browserErrors).toEqual([]);
  });

  test("duplicate-only completion never claims new transactions were saved", async ({ page }) => {
    await page.goto("/auth/e2e-transaction-import-completion?state=duplicates");

    const completion = page.getByRole("status");
    await expect(completion.getByRole("heading", { name: "لم تتم إضافة معاملات جديدة" })).toBeVisible();
    await expect(completion).toContainText("كل المعاملات كانت موجودة بالفعل أو تم تأكيدها كمكررة");
    await expect(completion.getByRole("heading", { name: "تم حفظ معاملاتك والتحقق منها" })).toHaveCount(0);
    await expect(completion).toContainText("إجمالي المعاملات المحفوظة");
    await expect(completion).toContainText("1284");
  });
});
