import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-funnel-list";
const businessId = "123e4567-e89b-42d3-a456-426614174000";
const funnelId = "123e4567-e89b-42d3-a456-426614174001";

/** Collects browser console and page errors so N44 fails on runtime regressions. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("N44 Funnel edit drawer", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("opens prefilled edit state, resets unsaved changes, and restores focus", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const trigger = page.getByRole("button", {
      name: "تعديل الفانل ويبينار البرنامج الأساسي",
    });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "تعديل ويبينار البرنامج الأساسي" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", {
        name: "إغلاق تعديل الفانل ويبينار البرنامج الأساسي",
      }),
    ).toBeFocused();

    await expect(dialog.locator('input[name="business_id"]')).toHaveValue(businessId);
    await expect(dialog.locator('input[name="funnel_id"]')).toHaveValue(funnelId);
    await expect(dialog.getByLabel("اسم الفانل")).toHaveValue("ويبينار البرنامج الأساسي");
    await expect(dialog.locator('select[name="funnel_type"]')).toHaveValue("webinar");
    await expect(dialog.locator('input[name="is_active"]')).toBeChecked();

    await dialog.getByLabel("اسم الفانل").fill("اسم مؤقت");
    await dialog.locator('select[name="funnel_type"]').selectOption("lead_gen");
    await dialog.locator('input[name="is_active"]').uncheck();
    await dialog.getByRole("button", { name: "إلغاء" }).click();

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog.getByLabel("اسم الفانل")).toHaveValue("ويبينار البرنامج الأساسي");
    await expect(dialog.locator('select[name="funnel_type"]')).toHaveValue("webinar");
    await expect(dialog.locator('input[name="is_active"]')).toBeChecked();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("keeps read-only Funnel cards stable without edit mutation controls", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?mode=read-only`);

    const list = page.getByRole("region", { name: "اختبار قائمة الفانلز" });
    await expect(list.getByText("عرض فقط")).toHaveCount(2);
    await expect(list.getByRole("button", { name: /تعديل الفانل/ })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test("uses a full-width mobile edit sheet without horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    await page
      .getByRole("button", { name: "تعديل الفانل ويبينار البرنامج الأساسي" })
      .click();

    const dialog = page.getByRole("dialog", { name: "تعديل ويبينار البرنامج الأساسي" });
    await expect(dialog).toBeVisible();

    const dimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const box = await dialog.boundingBox();
    expect(box?.width ?? 999).toBeLessThanOrEqual(390);

    await dialog.getByLabel("اسم الفانل").focus();
    await expect(dialog.getByLabel("اسم الفانل")).toBeFocused();

    expect(errors).toEqual([]);
  });
});
