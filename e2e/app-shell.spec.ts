import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";

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

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(liveEmail);
  await page.getByLabel("كلمة المرور").fill(livePassword);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("authenticated application shell", () => {
  test.skip(!liveEmail || !livePassword, "Requires live Mizan Supabase test credentials");

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("desktop shell is Arabic RTL and navigation works", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".desktop-sidebar")).toBeVisible();
    await expect(page.getByRole("heading", { name: "الرئيسية", level: 1 })).toBeVisible();
    await expect(
      page.locator(".desktop-sidebar").getByText(/^(مدير|متدرب)$/),
    ).toBeVisible();
    await expect(page.getByText("Admin", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Mentee", { exact: true })).toHaveCount(0);
    await expect(page.locator('.desktop-sidebar small[dir="ltr"]')).toHaveText(liveEmail);

    await page.screenshot({ path: "test-results/screenshots/home-desktop.png", fullPage: true });

    await page.getByRole("link", { name: "الأرقام الشهرية" }).click();
    await expect(page).toHaveURL(/\/monthly$/);
    await expect(page.getByRole("heading", { name: "الأرقام الشهرية", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "الأرقام الشهرية" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(errors).toEqual([]);
  });

  test("desktop sidebar remains usable in a short viewport", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1200, height: 420 });
    await page.goto("/");

    const sidebar = page.locator(".desktop-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveCSS("overflow-y", "auto");

    const dimensions = await sidebar.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

    const settingsLink = page.getByRole("link", { name: "الإعدادات" });
    await settingsLink.scrollIntoViewIfNeeded();
    await expect(settingsLink).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("mobile drawer opens, reaches its RTL position, navigates, and closes", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    const viewportWidth = 390;
    await page.setViewportSize({ width: viewportWidth, height: 844 });
    await page.goto("/");

    await expect(page.locator(".desktop-sidebar")).toBeHidden();
    await expect(page.locator(".mobile-topbar")).toBeVisible();

    const menuButton = page.locator(".menu-button");
    const drawer = page.locator(".mobile-drawer");
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(drawer).toBeVisible();

    await page.waitForTimeout(300);
    const drawerBox = await drawer.boundingBox();
    if (!drawerBox) {
      throw new Error("Mobile drawer has no rendered bounding box");
    }
    expect(drawerBox.width).toBeGreaterThan(330);
    expect(Math.abs(drawerBox.x + drawerBox.width - viewportWidth)).toBeLessThan(1);

    await page.screenshot({ path: "test-results/screenshots/home-mobile-drawer.png", fullPage: true });

    await page.getByRole("link", { name: "العملاء و LTV" }).click();
    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByRole("heading", { name: "العملاء و LTV", level: 1 })).toBeVisible();
    await expect(page.locator(".mobile-drawer-layer")).not.toHaveClass(/mobile-drawer-layer-open/);
    await page.screenshot({ path: "test-results/screenshots/customers-mobile.png", fullPage: true });
    expect(errors).toEqual([]);
  });

  test("mobile shell keeps primary controls touch-safe", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const menuButton = page.locator(".menu-button");
    const menuBox = await menuButton.boundingBox();
    expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(menuBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await menuButton.click();
    const closeButton = page.locator(".mobile-drawer .close-button");
    const signOutButton = page.locator(".mobile-drawer").getByRole("button", {
      name: "تسجيل الخروج",
    });
    await signOutButton.scrollIntoViewIfNeeded();

    for (const control of [closeButton, signOutButton]) {
      const box = await control.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    expect(errors).toEqual([]);
  });

  test("mobile drawer stays scrollable and usable in a short viewport", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 420 });
    await page.goto("/");

    await page.locator(".menu-button").click();
    const drawer = page.locator(".mobile-drawer");
    await expect(drawer).toHaveCSS("overflow-y", "auto");

    const dimensions = await drawer.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

    const settingsLink = drawer.getByRole("link", { name: "الإعدادات" });
    const signOutButton = drawer.getByRole("button", { name: "تسجيل الخروج" });
    await settingsLink.scrollIntoViewIfNeeded();
    await expect(settingsLink).toBeVisible();
    await signOutButton.scrollIntoViewIfNeeded();
    await expect(signOutButton).toBeVisible();

    await page.screenshot({
      path: "test-results/screenshots/home-mobile-short-drawer.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("top-level mobile pages do not create whole-page horizontal overflow", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const routes = [
      "/",
      "/monthly",
      "/customers",
      "/funnels",
      "/simulator",
      "/target-plan",
      "/analytics",
      "/settings",
    ];

    for (const route of routes) {
      await page.goto(route);
      const dimensions = await page.locator("html").evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(dimensions.scrollWidth, `horizontal overflow on ${route}`).toBeLessThanOrEqual(
        dimensions.clientWidth + 1,
      );
    }
    expect(errors).toEqual([]);
  });

  test("mobile drawer traps focus, makes the background inert, and restores focus", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const menuButton = page.locator(".menu-button");
    const closeButton = page.locator(".mobile-drawer .close-button");
    const appMain = page.locator(".app-main");

    await menuButton.focus();
    await expect(menuButton).toBeFocused();
    await menuButton.click();

    await expect(closeButton).toBeFocused();
    await expect(page.locator(".mobile-drawer")).toHaveAttribute("aria-modal", "true");
    expect(await appMain.evaluate((element) => (element as HTMLElement).inert)).toBe(true);

    await page.keyboard.press("Shift+Tab");
    await expect(page.locator(".mobile-drawer").getByRole("button", { name: "تسجيل الخروج" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(closeButton).toBeFocused();

    await closeButton.click();
    await expect(menuButton).toBeFocused();
    expect(await appMain.evaluate((element) => (element as HTMLElement).inert)).toBe(false);
    expect(errors).toEqual([]);
  });

  test("open mobile drawer releases the body lock when resizing to desktop", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto("/");

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
