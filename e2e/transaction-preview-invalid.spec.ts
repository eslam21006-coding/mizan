import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const hasLiveAuth = Boolean(liveEmail && livePassword);

test.describe("Task 17 invalid transaction preview", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials");

  test("rejects unsupported files without exposing an import action", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("البريد الإلكتروني").fill(liveEmail);
    await page.getByLabel("كلمة المرور").fill(livePassword);
    await page.getByRole("button", { name: "دخول" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/customers");
    const firstPreviewLink = page.getByRole("link", { name: "معاينة CSV / XLSX" }).first();
    test.skip((await firstPreviewLink.count()) === 0, "Live account has no accessible business");
    await firstPreviewLink.click();

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
