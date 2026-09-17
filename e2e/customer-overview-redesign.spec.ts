import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-customers-overview";

test.describe("Customer value overview redesign", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("prioritizes readable KPIs, collapses data sources, and keeps URL-backed analysis tabs accessible in Arabic RTL", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "العملاء وقيمة وربحية العميل" })).toBeVisible();

    const tabList = page.getByRole("tablist", { name: "أقسام تحليل العملاء" });
    const overviewTab = tabList.getByRole("tab", { name: /نظرة عامة/ });
    const observedTab = tabList.getByRole("tab", { name: /متوسط ما دفعه العميل/ });
    const contributionTab = tabList.getByRole("tab", { name: /ربحية العميل/ });
    const revenueTab = tabList.getByRole("tab", { name: /مصادر الإيراد/ });
    const customersTab = tabList.getByRole("tab", { name: /سجل العملاء/ });

    await expect(tabList.getByRole("tab")).toHaveCount(5);
    await expect(overviewTab).toHaveAttribute("aria-selected", "true");

    const historyOverview = page.getByRole("region", { name: "ملخص العملاء" });
    await expect(historyOverview).toBeVisible();
    await expect(historyOverview.getByText("العملاء المكتسبون")).toBeVisible();
    await expect(historyOverview.getByText("صافي التحصيل", { exact: true })).toBeVisible();
    await expect(historyOverview.getByText("العملاء المتكررون")).toBeVisible();
    await expect(historyOverview.getByText("صافي التحصيل لكل عميل دافع", { exact: true })).toBeVisible();
    await expect(historyOverview.getByText("1,260", { exact: true })).toBeVisible();
    await expect(historyOverview.getByText("321,575.88 USD", { exact: true })).toBeVisible();
    await expect(historyOverview.getByText("262", { exact: true })).toBeVisible();
    await expect(historyOverview.getByText("255.22 USD", { exact: true })).toBeVisible();
    await expect(historyOverview.getByText("21%", { exact: true })).toBeVisible();
    await expect(historyOverview.getByText("ليس LTV", { exact: false })).toBeVisible();
    await expect(
      historyOverview.getByText("Observed LTV / قيمة العميل المحققة حتى الآن", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("255.218952380952381", { exact: true })).toHaveCount(0);

    const setup = page.locator("details").filter({ hasText: "مصادر بيانات اقتصاديات العميل" });
    await expect(setup).toHaveCount(1);
    await expect(setup).not.toHaveAttribute("open", "");
    await expect(setup.getByText("فتح الاستيراد", { exact: true })).toBeHidden();
    await setup.locator("summary").click();
    await expect(setup).toHaveAttribute("open", "");
    await expect(setup.getByText("فتح الاستيراد", { exact: true })).toBeVisible();
    await expect(setup.getByText("فتح إعداد المصروفات", { exact: true })).toBeVisible();
    await expect(setup.getByText("ربط مصادر الإيراد", { exact: true }).last()).toBeVisible();
    await expect(setup.getByText(/توزيع التكاليف يدويًا/)).toHaveCount(0);

    const importLink = page.getByRole("link", { name: "استيراد معاملات" });
    await expect(importLink).toHaveAttribute(
      "href",
      "/businesses/00000000-0000-4000-8000-000000000057/customers/import",
    );
    await expect(page.getByRole("link", { name: "تنزيل نموذج CSV" })).toHaveAttribute(
      "href",
      "/mizan-transactions-template.csv",
    );

    await expect(observedTab).toHaveAttribute("aria-selected", "false");
    const observedPanelId = await observedTab.getAttribute("aria-controls");
    expect(observedPanelId).not.toBeNull();
    const observedPanel = page.locator(`#${observedPanelId}`);
    await expect(observedPanel).toBeHidden();
    await expect(observedPanel.getByRole("region", { name: "لوحة قيمة العميل المحققة" })).toHaveCount(0);

    const revenuePanelId = await revenueTab.getAttribute("aria-controls");
    expect(revenuePanelId).not.toBeNull();
    const revenuePanel = page.locator(`#${revenuePanelId}`);
    await expect(revenuePanel).toBeHidden();
    await expect(revenuePanel.getByRole("region", { name: "لوحة مصادر الإيراد" })).toHaveCount(0);

    await page.goto(`${fixturePath}?view=revenue-streams`);
    await expect(revenueTab).toHaveAttribute("aria-selected", "true");
    await expect(revenuePanel).toBeVisible();
    await expect(revenuePanel.getByRole("region", { name: "لوحة مصادر الإيراد" })).toBeVisible();
    await expect(historyOverview).toHaveCount(0);

    await page.goto(`${fixturePath}?view=profitability`);
    await expect(contributionTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("region", { name: "لوحة ربح المساهمة" })).toBeVisible();

    await page.goto(`${fixturePath}?view=customers`);
    await expect(customersTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("region", { name: "لوحة سجل العملاء" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    await expect(page.getByRole("tablist", { name: "أقسام تحليل العملاء" })).toBeVisible();
    await expect(historyOverview).toHaveCount(0);
    expect(browserErrors).toEqual([]);
  });
});
