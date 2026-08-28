import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-app-shell";

function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("CI-only application shell fixture", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("renders the shared shell as Arabic RTL with localized account metadata", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(fixturePath);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".desktop-sidebar")).toBeVisible();
    await expect(page.getByRole("heading", { name: "الرئيسية", level: 1 })).toBeVisible();
    await expect(page.locator(".desktop-sidebar").getByText("مدير", { exact: true })).toBeVisible();
    await expect(page.getByText("Admin", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Mentee", { exact: true })).toHaveCount(0);
    await expect(page.locator('.desktop-sidebar small[dir="ltr"]')).toHaveText(
      "admin.fixture@example.test",
    );

    await page.screenshot({
      path: "test-results/screenshots/app-shell-fixture-desktop.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("keeps the desktop sidebar usable in a short viewport", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1200, height: 420 });
    await page.goto(fixturePath);

    const sidebar = page.locator(".desktop-sidebar");
    await expect(sidebar).toHaveCSS("overflow-y", "auto");
    const dimensions = await sidebar.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

    const signOutButton = sidebar.getByRole("button", { name: "تسجيل الخروج" });
    await signOutButton.scrollIntoViewIfNeeded();
    await expect(signOutButton).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("keeps mobile controls touch-safe and the RTL drawer usable on a short phone", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    const viewportWidth = 390;
    await page.setViewportSize({ width: viewportWidth, height: 420 });
    await page.goto(fixturePath);

    const menuButton = page.locator(".menu-button");
    const menuBox = await menuButton.boundingBox();
    expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(menuBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await menuButton.click();
    const drawer = page.locator(".mobile-drawer");
    const closeButton = drawer.getByRole("button", { name: "إغلاق القائمة" });
    const signOutButton = drawer.getByRole("button", { name: "تسجيل الخروج" });

    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveCSS("overflow-y", "auto");
    await page.waitForTimeout(300);

    const drawerBox = await drawer.boundingBox();
    if (!drawerBox) throw new Error("Mobile drawer has no rendered bounding box");
    expect(drawerBox.width).toBeGreaterThan(330);
    expect(Math.abs(drawerBox.x + drawerBox.width - viewportWidth)).toBeLessThan(1);

    const drawerDimensions = await drawer.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(drawerDimensions.scrollHeight).toBeGreaterThan(drawerDimensions.clientHeight);

    for (const control of [closeButton, signOutButton]) {
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await page.screenshot({
      path: "test-results/screenshots/app-shell-fixture-mobile-short.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("traps mobile focus, restores it on close, and avoids page-level horizontal overflow", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(fixturePath);

    const htmlDimensions = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(htmlDimensions.scrollWidth).toBeLessThanOrEqual(htmlDimensions.clientWidth + 1);

    const menuButton = page.locator(".menu-button");
    const drawer = page.locator(".mobile-drawer");
    const closeButton = drawer.getByRole("button", { name: "إغلاق القائمة" });
    const appMain = page.locator(".app-main");

    await menuButton.focus();
    await menuButton.click();
    await expect(closeButton).toBeFocused();
    await expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(await appMain.evaluate((element) => (element as HTMLElement).inert)).toBe(true);

    await page.keyboard.press("Shift+Tab");
    await expect(drawer.getByRole("button", { name: "تسجيل الخروج" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(closeButton).toBeFocused();

    await closeButton.click();
    await expect(menuButton).toBeFocused();
    expect(await appMain.evaluate((element) => (element as HTMLElement).inert)).toBe(false);
    expect(errors).toEqual([]);
  });

  test("releases the mobile body lock when resizing to desktop", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto(fixturePath);

    await page.locator(".menu-button").click();
    await expect(page.locator("body")).toHaveClass(/mobile-menu-open/);

    await page.setViewportSize({ width: 1000, height: 500 });
    await expect(page.locator(".desktop-sidebar")).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/mobile-menu-open/);
    await expect(page.locator(".mobile-drawer-layer")).not.toHaveClass(/mobile-drawer-layer-open/);
    await expect
      .poll(() => page.locator("body").evaluate((element) => getComputedStyle(element).overflow))
      .not.toBe("hidden");
    expect(errors).toEqual([]);
  });
});
