import { expect, test } from "@playwright/test";

test.describe("Task 5 Customer Economics review UX", () => {
  test("shows exception review, legacy reconciliation, and audited correction in Arabic RTL", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto("/auth/e2e-customer-economics-review");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "ملاحظات تحتاج مراجعتك" })).toBeVisible();
    await expect(page.getByText("تكلفة اكتساب في شهر بلا عملاء جدد")).toBeVisible();
    await expect(page.getByText("صافي التحصيل لا يطابق سجل معاملات العملاء")).toBeVisible();
    await expect(page.getByText("4,500 EGP", { exact: true })).toBeVisible();

    await page.getByText("لدي دليل موثوق — توزيع نفس التكلفة يدويًا").click();
    await expect(page.getByLabel(/المبلغ الموزع على/).first()).toBeVisible();
    await expect(page.getByText(/يجب أن يساوي مجموع التوزيع التكلفة الفعلية بالضبط/)).toBeVisible();
    await expect(page.getByRole("button", { name: "حفظ التوزيع الاستثنائي" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "ربط التوزيعات اليدوية القديمة بمصروف فعلي" })).toBeVisible();
    await expect(page.getByText("توزيع يناير القديم")).toBeVisible();
    await expect(page.getByText("توزيع فبراير القديم")).toBeVisible();
    await expect(page.getByRole("button", { name: "ربط السجلات بالمصروف الفعلي" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "تصحيح شهر سابق" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "لماذا يتم تعديل هذا الشهر؟" })).toBeVisible();
    await expect(page.getByLabel("سبب التصحيح")).toBeVisible();
    await expect(page.getByRole("button", { name: "حفظ التصحيح التاريخي" })).toBeVisible();
    await expect(page.getByText(/نسخة قبل وبعد التصحيح/)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
    await expect(page.getByRole("heading", { name: "ملاحظات تحتاج مراجعتك" })).toBeVisible();

    expect(browserErrors).toEqual([]);
  });
});
