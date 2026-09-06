import { expect, test } from "@playwright/test";

test.describe("Customer and LTV overview redesign", () => {
  test("keeps the customer workflow clear and switches analysis tabs accessibly in Arabic RTL", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto("/auth/e2e-customers-overview");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "العملاء و LTV — بزنس الاختبار" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "مسار بيانات العملاء" })).toBeVisible();
    await expect(page.getByText("استورد التحصيلات والاسترجاعات")).toBeVisible();
    await expect(page.getByText("اربط المعاملات بمصادر الإيراد")).toBeVisible();
    await expect(page.getByText("أكمل التكاليف المرتبطة بالعميل")).toBeVisible();

    const importLink = page.getByRole("link", { name: "استيراد معاملات" });
    await expect(importLink).toHaveAttribute(
      "href",
      "/businesses/00000000-0000-4000-8000-000000000057/customers/import",
    );
    await expect(page.getByRole("link", { name: "تنزيل نموذج CSV" })).toHaveAttribute(
      "href",
      "/mizan-transactions-template.csv",
    );

    const tabList = page.getByRole("tablist", { name: "أقسام تحليل العملاء" });
    const observedTab = tabList.getByRole("tab", { name: /Observed LTV/ });
    const revenueTab = tabList.getByRole("tab", { name: /مصادر الإيراد/ });
    const contributionTab = tabList.getByRole("tab", { name: /ربح المساهمة/ });
    const customersTab = tabList.getByRole("tab", { name: /سجل العملاء/ });

    await expect(observedTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("region", { name: "لوحة قيمة العميل المحققة" })).toBeVisible();

    const revenuePanelId = await revenueTab.getAttribute("aria-controls");
    expect(revenuePanelId).not.toBeNull();
    const revenuePanel = page.locator(`#${revenuePanelId}`);
    await expect(revenuePanel).toHaveCount(1);
    await expect(revenuePanel).toBeHidden();
    await expect(revenuePanel.getByRole("region", { name: "لوحة مصادر الإيراد" })).toHaveCount(0);

    await revenueTab.click();
    await expect(revenueTab).toHaveAttribute("aria-selected", "true");
    await expect(revenuePanel).toBeVisible();
    await expect(revenuePanel.getByRole("region", { name: "لوحة مصادر الإيراد" })).toBeVisible();

    const observedPanelId = await observedTab.getAttribute("aria-controls");
    expect(observedPanelId).not.toBeNull();
    await expect(page.locator(`#${observedPanelId}`)).toBeHidden();

    await revenueTab.press("ArrowLeft");
    await expect(contributionTab).toBeFocused();
    await expect(contributionTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("region", { name: "لوحة ربح المساهمة" })).toBeVisible();

    await contributionTab.press("End");
    await expect(customersTab).toBeFocused();
    await expect(page.getByRole("region", { name: "لوحة سجل العملاء" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    await expect(page.getByRole("tablist", { name: "أقسام تحليل العملاء" })).toBeVisible();
    expect(browserErrors).toEqual([]);
  });
});
