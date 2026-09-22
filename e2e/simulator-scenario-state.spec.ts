import { expect, test } from "@playwright/test";

const BUSINESS_ID = "00000000-0000-4000-8000-000000000056";
const OTHER_BUSINESS_ID = "00000000-0000-4000-8000-000000000057";
const SCENARIO_A_ID = "00000000-0000-4000-8000-000000000561";
const STALE_SCENARIO_ID = "00000000-0000-4000-8000-000000000599";

/** Collects browser runtime errors during the persistent scenario journey. */
function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Returns the current query string as a URLSearchParams object for concise state assertions. */
function query(page: import("@playwright/test").Page) {
  return new URL(page.url()).searchParams;
}

test.describe("N56 persistent Simulator scenario state", () => {
  test("keeps a saved scenario across month changes, refresh, copied URL, and browser Back", async ({
    page,
  }) => {
    const browserErrors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/auth/e2e-simulator-scenario-state");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('[data-scenario-state="new"]')).toContainText("غير محفوظ");

    const monthForm = page.getByRole("form", { name: "تغيير الشهر المرجعي" });
    await expect(monthForm.locator('input[name="scenario"]')).toHaveCount(0);

    await page.getByRole("link", { name: "فتح سيناريو نمو" }).click();
    await expect.poll(() => query(page).get("scenario")).toBe(SCENARIO_A_ID);
    await expect(page.locator('[data-scenario-state="saved"]')).toContainText("سيناريو نمو");
    await expect(page.getByLabel("الإنفاق الإعلاني", { exact: true })).toHaveValue("12000");
    await expect(monthForm.locator('input[name="scenario"]')).toHaveValue(SCENARIO_A_ID);

    await page.getByRole("combobox", { name: "الشهر" }).selectOption("2026-09");
    await page.getByRole("button", { name: "فتح الشهر" }).click();
    await expect.poll(() => query(page).get("month")).toBe("2026-09");
    expect(query(page).get("scenario")).toBe(SCENARIO_A_ID);
    await expect(page.locator('[data-scenario-state="saved"]')).toContainText("سيناريو نمو");
    await expect(page.getByLabel("الإنفاق الإعلاني", { exact: true })).toHaveValue("12000");

    const copiedSavedUrl = page.url();
    await page.reload();
    await expect(page.locator('[data-scenario-state="saved"]')).toContainText("سيناريو نمو");

    await page.getByRole("link", { name: "سيناريو جديد" }).click();
    await expect.poll(() => query(page).get("scenario")).toBeNull();
    await expect(page.locator('[data-scenario-state="new"]')).toContainText("غير محفوظ");

    await page.goBack();
    await expect.poll(() => query(page).get("scenario")).toBe(SCENARIO_A_ID);
    expect(query(page).get("month")).toBe("2026-09");
    await expect(page.locator('[data-scenario-state="saved"]')).toContainText("سيناريو نمو");

    await page.goto(copiedSavedUrl);
    await expect(page.locator('[data-scenario-state="saved"]')).toContainText("سيناريو نمو");
    expect(query(page).get("scenario")).toBe(SCENARIO_A_ID);
    expect(query(page).get("month")).toBe("2026-09");

    await page.getByRole("link", { name: "فتح سيناريو كفاءة" }).click();
    await expect.poll(() => query(page).get("scenario")).not.toBe(SCENARIO_A_ID);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-scenario-state="saved"] strong')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      )
      .toBe(true);

    await page.goBack();
    await expect.poll(() => query(page).get("scenario")).toBe(SCENARIO_A_ID);

    const businessForm = page.getByRole("form", { name: "تغيير البزنس" });
    await expect(businessForm.locator('input[name="scenario"]')).toHaveCount(0);
    await page.getByRole("combobox", { name: "البزنس" }).selectOption(OTHER_BUSINESS_ID);
    await page.getByRole("button", { name: "فتح البزنس" }).click();
    await expect.poll(() => query(page).get("business")).toBe(OTHER_BUSINESS_ID);
    expect(query(page).get("scenario")).toBeNull();
    await expect(page.locator('[data-scenario-state="new"]')).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      )
      .toBe(true);

    expect(browserErrors).toEqual([]);
  });

  test("fails closed for stale, malformed, and duplicated scenario URL state", async ({ page }) => {
    await page.goto(
      `/auth/e2e-simulator-scenario-state?business=${BUSINESS_ID}&month=2026-08&scenario=${STALE_SCENARIO_ID}`,
    );

    await expect(page.locator('[data-scenario-state="unavailable"]')).toContainText(
      "السيناريو المحدد غير متاح",
    );
    await expect(page.getByRole("heading", { name: "عدّل السيناريو", level: 2 })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "بدء سيناريو جديد" })).toBeVisible();
    await expect(page.getByRole("button", { name: "فتح الشهر" })).toBeDisabled();

    await page.goto(
      `/auth/e2e-simulator-scenario-state?business=${BUSINESS_ID}&month=2026-08&scenario=not-a-scenario`,
    );
    await expect(page.locator('[data-scenario-state="unavailable"]')).toBeVisible();

    await page.goto(
      `/auth/e2e-simulator-scenario-state?business=${BUSINESS_ID}&month=2026-08&scenario=${SCENARIO_A_ID}&scenario=${STALE_SCENARIO_ID}`,
    );
    await expect(page.locator('[data-scenario-state="unavailable"]')).toBeVisible();
  });
});
