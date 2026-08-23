import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const hasLiveAuth = Boolean(liveEmail && livePassword);

test.describe("Task 17 invalid transaction preview", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials");

  test("rejects unsupported files without exposing an import action", async ({ page }) => {
    const businessName = `رفض ملف معاملات ${Date.now()}`;

    await page.goto("/login");
    await page.getByLabel("البريد الإلكتروني").fill(liveEmail);
    await page.getByLabel("كلمة المرور").fill(livePassword);
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/businesses/new");
    await page.getByLabel("اسم البزنس").fill(businessName);
    await page.getByLabel("اسم البزنس").press("Enter");
    await page.getByRole("button", { name: /EGP/ }).click();
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByLabel("المنطقة الزمنية").selectOption("Africa/Cairo");
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByRole("button", { name: "إنشاء البزنس" }).click();
    await expect(page).toHaveURL(/\/businesses\?status=created$/);

    await page.goto("/customers");
    const businessCard = page.locator("article").filter({ hasText: businessName });
    await expect(businessCard).toBeVisible();
    await businessCard.getByRole("link", { name: "معاينة CSV / XLSX" }).click();
    await expect(page.getByLabel("CSV أو XLSX")).toBeVisible();

    await page.getByLabel("CSV أو XLSX").setInputFiles({
      name: "gateway.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a supported payment export", "utf8"),
    });

    const previewError = page.getByRole("alert").filter({ hasText: "تعذر معاينة الملف" });
    await expect(previewError).toContainText("اختر ملف CSV أو XLSX فقط");
    await expect(page.getByRole("button", { name: "استيراد المعاملات" })).toHaveCount(0);
  });
});
