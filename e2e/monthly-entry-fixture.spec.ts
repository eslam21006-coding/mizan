import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-monthly-entry";
const fixtureBusinessId = "00000000-0000-4000-8000-000000000025";

function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("Monthly entry UX fixture", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("renders compact RTL entry groups with button-like month navigation", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الإدخال الشهري", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "الإيرادات والمرتجعات", level: 2 })).toBeVisible();
    await expect(page.getByRole("table", { name: "الإيرادات والمرتجعات حسب المصدر" })).toBeVisible();

    for (const name of ["الشهر السابق", "الشهر التالي"]) {
      const navigation = page.getByRole("link", { name });
      const box = await navigation.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(navigation).toHaveCSS("border-style", "solid");
    }

    const grossInput = page.getByLabel("الإيراد المحصل — Front-End Offer");
    const grossShell = grossInput.locator("..");
    const currencySuffix = grossShell.locator("small");
    await expect(grossShell).toHaveAttribute("dir", "ltr");
    await expect(currencySuffix).toHaveText("USD");
    const inputBox = await grossInput.boundingBox();
    const suffixBox = await currencySuffix.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(suffixBox).not.toBeNull();
    expect(suffixBox?.x ?? 0).toBeGreaterThan(
      (inputBox?.x ?? 0) + (inputBox?.width ?? 0) * 0.6,
    );

    await expect(page.getByText("إدخال يدوي", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("الإجمالي محسوب تلقائيًا", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("28,000 USD", { exact: true })).toBeVisible();
    await expect(page.getByText("19,000 USD", { exact: true })).toBeVisible();

    await page.screenshot({
      path: "test-results/screenshots/monthly-entry-fixture-desktop.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("updates per-stream net without treating blank or malformed grouped inputs as amounts", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto(fixturePath);

    const gross = page.getByLabel("الإيراد المحصل — Front-End Offer");
    const refunds = page.getByLabel("المرتجعات — Front-End Offer");
    const missingNetHint = page.getByText("أدخل المحصل والمرتجعات لإظهار الصافي.").first();

    await gross.fill("");
    await expect(missingNetHint).toBeVisible();

    await gross.fill("1٬2");
    await refunds.fill("0");
    await expect(missingNetHint).toBeVisible();

    await gross.fill("١٬٢٣٤");
    await refunds.fill("٢٣٤");
    await expect(page.getByText("1,000 USD", { exact: true })).toBeVisible();

    await gross.fill("31000");
    await refunds.fill("1000");
    await expect(page.getByText("30,000 USD", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("preserves only safe external Return origins with exact month context", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${fixturePath}?month=2026-08&origin=customer-profitability`);

    const returnBanner = page.getByRole("region", { name: "سياق العودة من الإدخال الشهري" });
    await expect(returnBanner).toBeVisible();
    await expect(returnBanner.getByText("أنت هنا لإكمال بيانات مطلوبة في ربحية العميل")).toBeVisible();
    const profitabilityReturn = returnBanner.getByRole("link", { name: "العودة إلى ربحية العميل" });
    await expect(profitabilityReturn).toHaveAttribute(
      "href",
      `/businesses/${fixtureBusinessId}/customers?view=profitability&month=2026-08`,
    );
    await profitabilityReturn.focus();
    await expect(profitabilityReturn).toBeFocused();

    await page.reload();
    await expect(returnBanner).toBeVisible();
    await expect(profitabilityReturn).toHaveAttribute(
      "href",
      `/businesses/${fixtureBusinessId}/customers?view=profitability&month=2026-08`,
    );

    await page.goto(
      `${fixturePath}?month=2026-07&origin=customer-profitability&return_month=2026-08`,
    );
    const exactReturn = page.getByRole("region", { name: "سياق العودة من الإدخال الشهري" });
    await expect(exactReturn.getByRole("link", { name: "العودة إلى ربحية العميل" })).toHaveAttribute(
      "href",
      `/businesses/${fixtureBusinessId}/customers?view=profitability&month=2026-08`,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(returnBanner).toBeVisible();
    await expect(profitabilityReturn).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);

    await page.goto(`${fixturePath}?month=2026-08&origin=customer-overview`);
    const customerReturn = page.getByRole("region", { name: "سياق العودة من الإدخال الشهري" });
    await expect(customerReturn.getByText("أنت هنا لإكمال بيانات مطلوبة في تحليل العملاء")).toBeVisible();
    await expect(customerReturn.getByRole("link", { name: "العودة إلى العملاء" })).toHaveAttribute(
      "href",
      `/businesses/${fixtureBusinessId}/customers`,
    );

    for (const unsafeQuery of [
      "month=2026-08&origin=monthly-editor",
      "month=2026-08&origin=https://evil.example/return",
      "month=2026-08&origin=customer-profitability&origin=customer-overview",
      "month=2026-08&origin=customer-profitability&return_month=invalid",
    ]) {
      await page.goto(`${fixturePath}?${unsafeQuery}`);
      await expect(page.getByRole("region", { name: "سياق العودة من الإدخال الشهري" })).toHaveCount(0);
    }

    expect(errors).toEqual([]);
  });

  test("stays usable at 390px with no page-level horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    for (const label of [
      "الإيراد المحصل — Front-End Offer",
      "المرتجعات — Front-End Offer",
      "عملاء جدد",
      "Meta Ads — القيمة الشهرية",
    ]) {
      await expect(page.getByLabel(label)).toBeVisible();
    }

    const saveBar = page.getByTestId("monthly-save-bar");
    const saveButton = page.getByRole("button", { name: "حفظ الشهر" });
    await expect(saveBar).toHaveCSS("position", "fixed");
    await expect(saveButton).toBeVisible();

    const barBox = await saveBar.boundingBox();
    expect(barBox).not.toBeNull();
    expect((barBox?.y ?? 999) + (barBox?.height ?? 999)).toBeLessThanOrEqual(844);

    const lastField = page.getByLabel("Payment Fees — النسبة %");
    await lastField.evaluate((element) => element.scrollIntoView({ block: "nearest" }));
    await lastField.focus();
    const fieldBox = await lastField.boundingBox();
    const focusedBarBox = await saveBar.boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(focusedBarBox).not.toBeNull();
    expect((fieldBox?.y ?? 999) + (fieldBox?.height ?? 999)).toBeLessThanOrEqual(
      (focusedBarBox?.y ?? 0) - 4,
    );

    await page.screenshot({
      path: "test-results/screenshots/monthly-entry-fixture-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
