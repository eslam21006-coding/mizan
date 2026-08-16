import { expect, test } from "@playwright/test";

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

test("desktop shell is Arabic RTL and navigation works", async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".desktop-sidebar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "الرئيسية", level: 1 })).toBeVisible();

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

test("mobile drawer opens, reaches its RTL position, navigates, and closes", async ({ page }) => {
  const errors = captureBrowserErrors(page);
  const viewportWidth = 390;
  await page.setViewportSize({ width: viewportWidth, height: 844 });
  await page.goto("/");

  await expect(page.locator(".desktop-sidebar")).toBeHidden();
  await expect(page.locator(".mobile-topbar")).toBeVisible();

  const menuButton = page.getByRole("button", { name: "فتح القائمة" });
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
