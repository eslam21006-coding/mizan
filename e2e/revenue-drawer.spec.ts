import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-revenue-drawer";

function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N30 + N31 Revenue Source drawer", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("opens create/edit drawers with return metadata and restores focus", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const createTrigger = page.getByRole("button", { name: "إضافة مصدر إيراد" });
    await createTrigger.click();

    const createDialog = page.getByRole("dialog", { name: "إضافة مصدر إيراد جديد" });
    await expect(createDialog).toBeVisible();
    await expect(
      createDialog.getByRole("button", { name: "إغلاق إضافة مصدر إيراد" }),
    ).toBeFocused();
    await expect(createDialog.locator('input[name="origin"]')).toHaveValue("monthly-editor");
    await expect(createDialog.locator('input[name="month"]')).toHaveValue("2026-09");
    await expect(createDialog.locator('input[name="upstream_origin"]')).toHaveValue(
      "customer-profitability",
    );
    await expect(createDialog.locator('input[name="upstream_month"]')).toHaveValue("2026-07");
    await expect(createDialog.locator('input[name="creation_request_id"]')).toHaveValue(
      "123e4567-e89b-42d3-a456-426614174011",
    );

    await page.keyboard.press("Escape");
    await expect(createDialog).toBeHidden();
    await expect(createTrigger).toBeFocused();

    const editTrigger = page.getByRole("button", { name: "تعديل" });
    await editTrigger.click();

    const editDialog = page.getByRole("dialog", { name: "تعديل البرنامج الأساسي" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.locator('input[name="name"]')).toHaveValue("البرنامج الأساسي");
    await expect(editDialog.locator('select[name="stream_type"]')).toHaveValue("front_end");
    await expect(editDialog.locator('input[name="is_active"]')).toBeChecked();
    await expect(editDialog.locator('input[name="stream_id"]')).toHaveValue(
      "123e4567-e89b-42d3-a456-426614174012",
    );

    await editDialog.getByRole("button", { name: "إلغاء" }).click();
    await expect(editDialog).toBeHidden();
    await expect(editTrigger).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("uses a full-width mobile sheet without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    await page.getByRole("button", { name: "إضافة مصدر إيراد" }).click();
    const dialog = page.getByRole("dialog", { name: "إضافة مصدر إيراد جديد" });
    await expect(dialog).toBeVisible();

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const box = await dialog.boundingBox();
    expect(box?.width ?? 999).toBeLessThanOrEqual(390);

    await dialog.getByLabel("اسم مصدر الإيراد").focus();
    await expect(dialog.getByLabel("اسم مصدر الإيراد")).toBeFocused();

    expect(errors).toEqual([]);
  });
});
