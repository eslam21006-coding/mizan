import { expect, test, type Page } from "@playwright/test";
import { expectFullScreenMobileSheet } from "./mobile-sheet-assertions";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-funnel-create-drawer";
const businessId = "123e4567-e89b-42d3-a456-426614174000";
const creationRequestId = "123e4567-e89b-42d3-a456-426614174010";

/** Collects browser console and page errors so N43 fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N43 Funnel create drawer", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("opens in-context, preserves create fields, resets on close, and restores focus", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const actionSlot = page.getByRole("group", { name: "إجراءات الفانلز" });
    const trigger = page.getByRole("button", { name: "إضافة فانل" });
    await expect(actionSlot).toHaveAttribute("data-action-state", "normal");
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "إضافة فانل جديدة" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "إغلاق إضافة فانل" })).toBeFocused();
    await expect(dialog.locator('input[name="business_id"]')).toHaveValue(businessId);
    await expect(dialog.locator('input[name="creation_request_id"]')).toHaveValue(
      creationRequestId,
    );
    await expect(dialog.locator('select[name="funnel_type"]')).toHaveValue("webinar");

    await dialog.getByLabel("اسم الفانل").fill("اسم مؤقت");
    await dialog.locator('select[name="funnel_type"]').selectOption("lead_gen");
    await dialog.getByRole("button", { name: "إلغاء" }).click();

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog.getByLabel("اسم الفانل")).toHaveValue("");
    await expect(dialog.locator('select[name="funnel_type"]')).toHaveValue("webinar");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("keeps a stable read-only action state without create controls", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?mode=read-only`);

    const actionSlot = page.getByRole("group", { name: "إجراءات الفانلز" });
    await expect(actionSlot).toHaveAttribute("data-action-state", "read-only");
    await expect(actionSlot).toContainText("عرض فقط");
    await expect(page.getByRole("button", { name: "إضافة فانل" })).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("uses a full-width mobile sheet without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    await page.getByRole("button", { name: "إضافة فانل" }).click();
    const dialog = page.getByRole("dialog", { name: "إضافة فانل جديدة" });
    await expect(dialog).toBeVisible();

    await expectFullScreenMobileSheet(page, dialog);

    await dialog.getByLabel("اسم الفانل").focus();
    await expect(dialog.getByLabel("اسم الفانل")).toBeFocused();

    expect(errors).toEqual([]);
  });
});
