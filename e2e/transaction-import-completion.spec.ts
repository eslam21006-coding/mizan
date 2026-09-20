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

    const breadcrumb = page.getByRole("navigation", { name: "مسار استيراد معاملات العملاء" });
    await expect(breadcrumb.getByRole("link", { name: "البزنسات" })).toHaveAttribute("href", "/businesses");
    await expect(breadcrumb.getByRole("link", { name: "Fixture Business" })).toHaveAttribute(
      "href",
      "/?business=fixture-business",
    );
    await expect(breadcrumb.getByRole("link", { name: "العملاء وقيمة العميل" })).toHaveAttribute(
      "href",
      "/businesses/fixture-business/customers",
    );
    await expect(breadcrumb.getByText("استيراد المعاملات", { exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("link", { name: "إلغاء الاستيراد" })).toHaveAttribute(
      "href",
      "/businesses/fixture-business/customers",
    );

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

  test("returns to an allow-listed origin and rejects arbitrary return URLs", async ({ page }) => {
    await page.goto(
      "/auth/e2e-transaction-import-completion?origin=monthly-editor&month=2026-08",
    );

    const exactMonthlyHref = "/businesses/fixture-business/monthly?month=2026-08";
    await expect(page.getByRole("link", { name: "إلغاء الاستيراد" })).toHaveAttribute(
      "href",
      exactMonthlyHref,
    );
    await expect(page.getByRole("link", { name: "العودة إلى الإدخال الشهري" })).toHaveAttribute(
      "href",
      exactMonthlyHref,
    );
    await expect(page.getByText("ارجع إلى نفس شهر الإدخال الشهري بعد تحديث سجل المعاملات.")).toBeVisible();

    await page.goto(
      "/auth/e2e-transaction-import-completion?origin=customer-profitability&month=2026-07",
    );
    const profitabilityHref =
      "/businesses/fixture-business/customers?view=profitability&month=2026-07";
    await expect(page.getByRole("link", { name: "إلغاء الاستيراد" })).toHaveAttribute(
      "href",
      profitabilityHref,
    );
    await expect(page.getByRole("link", { name: "العودة إلى ربحية العميل" })).toHaveAttribute(
      "href",
      profitabilityHref,
    );

    await page.goto(
      "/auth/e2e-transaction-import-completion?origin=https%3A%2F%2Fevil.example&month=2026-08",
    );
    await expect(page.getByRole("link", { name: "إلغاء الاستيراد" })).toHaveAttribute(
      "href",
      "/businesses/fixture-business/customers",
    );
    await expect(page.getByRole("link", { name: "عرض تحليل العملاء" })).toHaveAttribute(
      "href",
      "/businesses/fixture-business/customers",
    );
    await expect(page.locator('a[href*="evil.example"]')).toHaveCount(0);
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
