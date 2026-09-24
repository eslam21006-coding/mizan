import { expect, type Locator, type Page } from "@playwright/test";

/** Verifies a mobile modal fills the viewport while the document itself remains overflow-free. */
export async function expectFullScreenMobileSheet(page: Page, dialog: Locator) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (!viewport || !box) return;

  expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.width - viewport.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.height - viewport.height)).toBeLessThanOrEqual(1);

  const dimensions = await page.locator("html").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  const overflow = await dialog.evaluate((element) => getComputedStyle(element).overflow);
  expect(overflow).toBe("hidden");
}
