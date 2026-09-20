import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-customers-overview";

test.describe("Customer value overview redesign", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("keeps one primary hero action, opens Data Sources in-context, and preserves URL-backed analysis tabs in Arabic RTL", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const pageHeading = page.getByRole("heading", { name: "العملاء وقيمة وربحية العميل" });
    await expect(pageHeading).toBeVisible();

    const hero = page.locator("section").filter({ has: pageHeading });
    const importLink = hero.getByRole("link", { name: "استيراد معاملات" });
    await expect(hero.getByRole("link")).toHaveCount(1);
    await expect(importLink).toHaveAttribute(
      "href",
      "/businesses/00000000-0000-4000-8000-000000000057/customers/import?origin=customer-overview",
    );
    await expect(hero.getByRole("link", { name: "ملاحظات تحتاج مراجعتك" })).toHaveCount(0);
    await expect(hero.getByRole("link", { name: "كل البزنسات" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "تنزيل نموذج CSV" })).toHaveCount(0);

    const dataSourcesCard = page.getByRole("button", { name: /مصادر بيانات اقتصاديات العميل/ });
    await expect(dataSourcesCard).toBeVisible();
    await expect(dataSourcesCard).toHaveAttribute("aria-haspopup", "dialog");
    await dataSourcesCard.focus();
    await expect(dataSourcesCard).toBeFocused();
    await dataSourcesCard.press("Enter");

    const dataSourcesDrawer = page.getByRole("dialog", { name: "مصادر بيانات اقتصاديات العميل" });
    await expect(dataSourcesDrawer).toBeVisible();
    await expect(dataSourcesDrawer.getByRole("link", { name: "فتح الاستيراد" })).toHaveAttribute(
      "href",
      "/businesses/00000000-0000-4000-8000-000000000057/customers/import?origin=customer-overview",
    );
    await expect(dataSourcesDrawer.getByRole("link", { name: "فتح إعداد المصروفات" })).toHaveAttribute(
      "href",
      "/businesses/00000000-0000-4000-8000-000000000057/expenses",
    );
    await expect(dataSourcesDrawer.getByRole("link", { name: "ربط مصادر الإيراد" })).toHaveAttribute(
      "href",
      "/businesses/00000000-0000-4000-8000-000000000057/customers/revenue-stream-attribution",
    );
    await expect(dataSourcesDrawer.getByText(/توزيع التكاليف يدويًا/)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dataSourcesDrawer).toBeHidden();
    await expect(dataSourcesCard).toBeFocused();

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

    await expect(observedTab).toHaveAttribute("aria-selected", "false");
    const observedPanelId = await observedTab.getAttribute("aria-controls");
    expect(observedPanelId).not.toBeNull();
    const observedPanel = page.locator(`#${observedPanelId}`);
    await expect(observedPanel).toBeHidden();
    await expect(observedPanel.getByRole("region", { name: "لوحة قيمة العميل المحققة" })).toHaveCount(0);

    await observedTab.focus();
    await expect(observedTab).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(new RegExp(`${fixturePath}\\?view=overview$`));
    await expect(overviewTab).toBeFocused();
    await expect(overviewTab).toHaveAttribute("aria-selected", "true");
    await expect(historyOverview).toBeVisible();

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
    await expect(page.getByRole("link", { name: "استيراد معاملات" })).toHaveAttribute(
      "href",
      "/businesses/00000000-0000-4000-8000-000000000057/customers/import?origin=customer-profitability",
    );

    await page.goto(`${fixturePath}?view=customers`);
    await expect(customersTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("region", { name: "لوحة سجل العملاء" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    await expect(importLink).toBeVisible();
    await expect(dataSourcesCard).toBeVisible();
    await dataSourcesCard.click();
    await expect(dataSourcesDrawer).toBeVisible();
    await expect
      .poll(() => dataSourcesDrawer.evaluate((element) => element.scrollWidth <= element.clientWidth))
      .toBe(true);
    const drawerBox = await dataSourcesDrawer.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox!.width).toBeLessThanOrEqual(390);
    await page.getByRole("button", { name: "إغلاق مصادر البيانات" }).click();
    await expect(dataSourcesDrawer).toBeHidden();
    await expect(page.getByRole("tablist", { name: "أقسام تحليل العملاء" })).toBeVisible();
    await expect(historyOverview).toHaveCount(0);
    expect(browserErrors).toEqual([]);
  });
});
