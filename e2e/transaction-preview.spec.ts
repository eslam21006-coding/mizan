import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const liveInviteTokenHash = process.env.MIZAN_E2E_INVITE_TOKEN_HASH?.trim() ?? "";
const hasLiveAuth = Boolean(liveInviteTokenHash || (liveEmail && livePassword));

async function login(page: import("@playwright/test").Page) {
  if (liveInviteTokenHash) {
    await page.goto(
      `/auth/confirm?token_hash=${encodeURIComponent(liveInviteTokenHash)}&type=invite`,
    );
    await expect(page).toHaveURL(/\/set-password$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    return;
  }

  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(liveEmail);
  await page.getByLabel("كلمة المرور").fill(livePassword);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("Transaction import UX and validation", () => {
  test.skip(!hasLiveAuth, "Requires live Mizan Supabase credentials or a one-use invite token");

  test("shows the template contract and validates mapped CSV rows", async ({ page }) => {
    test.setTimeout(150_000);

    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `Validation معاملات ${suffix}`;

    await login(page);
    await page.setViewportSize({ width: 1440, height: 1000 });

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
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "استيراد CSV / XLSX" }).click();
    await expect(page).toHaveURL(/\/businesses\/[^/]+\/customers\/import$/);

    await expect(page.getByRole("heading", { name: "ماذا يجب أن يحتوي الملف؟" })).toBeVisible();
    await expect(page.getByText("Customer Email", { exact: true })).toBeVisible();
    await expect(page.getByText("Transaction Date", { exact: true })).toBeVisible();
    await expect(page.getByText("Amount Collected", { exact: true })).toBeVisible();
    await expect(page.getByText("Transaction ID", { exact: true })).toBeVisible();
    await expect(page.getByText("Currency", { exact: true })).toBeVisible();
    await expect(page.getByText(/افصلهما إلى ملفين/)).toBeVisible();

    const templateLink = page.getByRole("link", { name: "تنزيل نموذج CSV" });
    await expect(templateLink).toHaveAttribute("href", "/mizan-transactions-template.csv");
    await expect(templateLink).toHaveAttribute("download", "mizan-transactions-template.csv");
    const templateResponse = await page.request.get("/mizan-transactions-template.csv");
    expect(templateResponse.ok()).toBe(true);
    const templateText = await templateResponse.text();
    expect(templateText).toContain("Customer Email,Transaction Date,Amount Collected,Transaction ID,Currency");

    const lines = ["Customer Email,Transaction Date,Amount Collected,Status"];
    for (let index = 1; index <= 29; index += 1) {
      lines.push(`buyer${index}@example.com,2026-08-23,${index},paid`);
    }
    lines.push("not-an-email,2026-08-23,30,paid");

    await page.getByLabel("اختر ملف CSV أو XLSX").setInputFiles({
      name: "gateway-export.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(lines.join("\n"), "utf8"),
    });

    await expect(page.getByRole("heading", { name: "راجع الملف", level: 2 })).toBeVisible();
    const rowsTerm = page.getByText("الصفوف", { exact: true });
    await expect(rowsTerm.locator("xpath=following-sibling::dd[1]")).toHaveText("31");

    await page.getByLabel("البريد الإلكتروني للعميل").selectOption("0");
    await page.getByLabel("تاريخ المعاملة").selectOption("1");
    await page.getByLabel("المبلغ المحصل").selectOption("2");
    await expect(page.getByText("الأعمدة مكتملة", { exact: true })).toBeVisible();

    await page.getByRole("checkbox", { name: /أول صف غير فارغ يحتوي على عناوين الأعمدة/ }).check();
    await page.getByRole("button", { name: "مراجعة الملف" }).click();

    await expect(page.getByText("تحتاج إلى تعديل", { exact: true })).toBeVisible();
    const checkedRows = page.getByText("صفوف تم فحصها", { exact: true });
    await expect(checkedRows.locator("xpath=following-sibling::strong[1]")).toHaveText("30");
    const invalidRows = page.getByText("صفوف غير صالحة", { exact: true });
    await expect(invalidRows.locator("xpath=following-sibling::strong[1]")).toHaveText("1");

    const issueTable = page.getByRole("table", { name: "جدول أخطاء معاملات العملاء" });
    await expect(issueTable).toContainText("31");
    await expect(issueTable).toContainText("صيغة بريد العميل غير صالحة");
    await expect(issueTable).toContainText("not-an-email");

    await expect(page.getByRole("button", { name: "استيراد المعاملات" })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      )
      .toBe(true);

    expect(browserErrors).toEqual([]);
  });
});
