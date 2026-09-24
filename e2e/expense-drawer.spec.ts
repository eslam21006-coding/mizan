import { expect, test, type Page } from "@playwright/test";
import { expectFullScreenMobileSheet } from "./mobile-sheet-assertions";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-expense-drawer";

function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N28 + N29 Expense drawer", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("opens create and edit drawers with preserved return metadata and restores focus", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const createTrigger = page.getByRole("button", { name: "إضافة مصروف" });
    await createTrigger.click();

    const createDialog = page.getByRole("dialog", { name: "إضافة مصروف جديد" });
    await expect(createDialog).toBeVisible();
    await expect(createDialog.getByRole("button", { name: "إغلاق إضافة مصروف" })).toBeFocused();
    await expect(createDialog.locator('input[name="origin"]')).toHaveValue("monthly-editor");
    await expect(createDialog.locator('input[name="month"]')).toHaveValue("2026-09");
    await expect(createDialog.locator('input[name="upstream_origin"]')).toHaveValue(
      "customer-profitability",
    );
    await expect(createDialog.locator('input[name="upstream_month"]')).toHaveValue("2026-07");
    await expect(createDialog.locator('input[name="creation_request_id"]')).toHaveValue(
      "123e4567-e89b-42d3-a456-426614174001",
    );

    await page.keyboard.press("Escape");
    await expect(createDialog).toBeHidden();
    await expect(createTrigger).toBeFocused();

    const editTrigger = page.getByRole("button", { name: "تعديل" });
    await editTrigger.click();

    const editDialog = page.getByRole("dialog", { name: "تعديل إعلانات Meta" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.locator('input[name="name"]')).toHaveValue("إعلانات Meta");
    await expect(editDialog.locator('select[name="category"]')).toHaveValue("acquisition");
    await expect(editDialog.locator('select[name="cost_behavior"]')).toHaveValue("fixed_monthly");
    await expect(editDialog.locator('input[name="is_active"]')).toBeChecked();
    await expect(editDialog.locator('input[name="expense_id"]')).toHaveValue(
      "123e4567-e89b-42d3-a456-426614174002",
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

    await page.getByRole("button", { name: "إضافة مصروف" }).click();
    const dialog = page.getByRole("dialog", { name: "إضافة مصروف جديد" });
    await expect(dialog).toBeVisible();

    await expectFullScreenMobileSheet(page, dialog);

    await dialog.getByLabel("اسم المصروف").focus();
    await expect(dialog.getByLabel("اسم المصروف")).toBeFocused();

    expect(errors).toEqual([]);
  });
});
