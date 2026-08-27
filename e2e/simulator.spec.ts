import { expect, test } from "@playwright/test";

const CONTROL_LABELS = [
  "قيمة العميل",
  "تكلفة الليد (CPL)",
  "الإنفاق الإعلاني",
  "نسبة الحضور",
  "نسبة التأهيل",
  "نسبة الإغلاق",
  "التكاليف الثابتة غير الإعلانية",
  "التكلفة المتغيرة لكل عميل جديد",
  "إيراد إضافي من Upsells",
  "إيراد إضافي من التجديدات",
  "إيراد إضافي من Backend",
] as const;

function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("Tasks 33-34 Simulator", () => {
  test("renders all controls, recalculates Current vs Scenario, resets saved state, and stays responsive RTL", async ({
    page,
  }) => {
    const browserErrors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/auth/e2e-simulator");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "اختبار المحاكي", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "عدّل السيناريو", level: 2 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "الحالي مقابل السيناريو", level: 2 }),
    ).toBeVisible();

    for (const label of CONTROL_LABELS) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }

    await expect(page.getByText("هذا ليس LTV.", { exact: false })).toBeVisible();
    await expect(
      page.getByText("التكلفة الكاملة للبزنس لكل عميل جديد", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("السيناريو منفصل عن التاريخ", { exact: false }),
    ).toBeVisible();

    const comparisonSection = page
      .getByRole("heading", { name: "الحالي مقابل السيناريو", level: 2 })
      .locator("xpath=ancestor::section");
    const netCashRow = comparisonSection
      .getByText("صافي الكاش المحصل", { exact: true })
      .locator("xpath=..");
    const newCustomersRow = comparisonSection
      .getByText("العملاء الجدد", { exact: true })
      .locator("xpath=..");
    const profitRow = comparisonSection
      .getByText("صافي الربح الحقيقي", { exact: true })
      .locator("xpath=..");

    await expect(netCashRow.locator("span").nth(0)).toHaveText("٥٠٬٠٠٠ EGP");
    await expect(netCashRow.locator("span").nth(1)).toHaveText("٥٠٬٠٠٠ EGP");
    await expect(newCustomersRow.locator("span").nth(0)).toHaveText("٥٠");
    await expect(newCustomersRow.locator("span").nth(1)).toHaveText("٥٠");

    const adSpendInput = page.getByLabel("الإنفاق الإعلاني", { exact: true });
    await adSpendInput.fill("١٢٬٠٠٠");
    await expect(adSpendInput).toHaveValue("12000");

    await expect(netCashRow.locator("span").nth(1)).toHaveText("٦٠٬٠٠٠ EGP");
    await expect(newCustomersRow.locator("span").nth(1)).toHaveText("٦٠");
    await expect(profitRow.locator("span").nth(1)).toHaveText("٢٦٬٠٠٠ EGP");

    const funnelSection = page
      .getByRole("heading", { name: "الأحجام التشغيلية", level: 2 })
      .locator("xpath=ancestor::section");
    const leadsCard = funnelSection.locator("article").filter({ hasText: "الليدز" });
    const funnelCustomersCard = funnelSection
      .locator("article")
      .filter({ hasText: "العملاء الجدد" });
    await expect(leadsCard.locator("strong")).toHaveText("٦٠٠");
    await expect(funnelCustomersCard.locator("strong")).toHaveText("٦٠");

    await page.screenshot({ path: "test-results/screenshots/simulator-desktop.png", fullPage: true });

    await page.getByRole("link", { name: "فتح سيناريو أ" }).click();
    await expect(page).toHaveURL(/\/auth\/e2e-simulator\?scenario=a$/);
    await expect(page.getByLabel("اسم السيناريو", { exact: true })).toHaveValue("سيناريو أ");
    await expect(page.getByLabel("الإنفاق الإعلاني", { exact: true })).toHaveValue("12000");
    await page.getByLabel("اسم السيناريو", { exact: true }).fill("اسم مؤقت");

    await page.getByRole("link", { name: "فتح سيناريو ب" }).click();
    await expect(page).toHaveURL(/\/auth\/e2e-simulator\?scenario=b$/);
    await expect(page.getByLabel("اسم السيناريو", { exact: true })).toHaveValue("سيناريو ب");
    await expect(page.getByLabel("الإنفاق الإعلاني", { exact: true })).toHaveValue("10000");
    await expect(page.getByLabel("قيمة العميل", { exact: true })).toHaveValue("1100");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await page.screenshot({ path: "test-results/screenshots/simulator-mobile.png", fullPage: true });

    expect(browserErrors).toEqual([]);
  });
});
