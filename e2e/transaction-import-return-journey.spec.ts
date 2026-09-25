import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const BUSINESS_ID = "00000000-0000-4000-8000-000000000025";

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

/** Redirects production-shaped Import/Monthly links into authenticated fixtures without changing their query contracts. */
async function installTransactionImportJourneyRedirects(page: Page) {
  await page.route(`**/businesses/${BUSINESS_ID}/customers/import?**`, async (route) => {
    const url = new URL(route.request().url());
    const fixtureUrl = new URL("/auth/e2e-transaction-import-completion", url.origin);
    for (const [key, value] of url.searchParams) fixtureUrl.searchParams.append(key, value);
    fixtureUrl.searchParams.set("businessId", BUSINESS_ID);
    fixtureUrl.searchParams.set("stage", "entry");
    await route.continue({ url: fixtureUrl.toString() });
  });

  await page.route(`**/businesses/${BUSINESS_ID}/monthly?**`, async (route) => {
    const url = new URL(route.request().url());
    await route.continue({ url: `${url.origin}/auth/e2e-monthly-entry${url.search}` });
  });
}

test.describe("N68 Transaction Import return journey", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("returns from verified Import completion to the exact originating Monthly month on mobile", async ({
    page,
  }) => {
    const browserErrors = collectBrowserErrors(page);
    await installTransactionImportJourneyRedirects(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/auth/e2e-monthly-entry?month=2026-08");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("أغسطس ٢٠٢٦", { exact: true })).toBeVisible();

    const importLink = page.getByRole("link", {
      name: "مراجعة وتأكيد اكتمال سجل المعاملات",
    });
    const importHref =
      `/businesses/${BUSINESS_ID}/customers/import?origin=monthly-editor&month=2026-08`;
    await expect(importLink).toHaveAttribute("href", importHref);
    await expectNoHorizontalOverflow(page);

    await importLink.click();

    await expect(page.getByRole("heading", { name: "استيراد معاملات العملاء" })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("origin")).toBe("monthly-editor");
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2026-08");
    const exactMonthlyHref = `/businesses/${BUSINESS_ID}/monthly?month=2026-08`;
    await expect(page.getByRole("link", { name: "إلغاء الاستيراد" })).toHaveAttribute(
      "href",
      exactMonthlyHref,
    );
    await expectNoHorizontalOverflow(page);

    await page.getByRole("link", { name: "محاكاة اكتمال الاستيراد" }).click();

    const completion = page.getByRole("status");
    await expect(
      completion.getByRole("heading", { name: "تم حفظ معاملاتك والتحقق منها" }),
    ).toBeVisible();
    await expect(completion).toContainText("تحقق ميزان من وجود 9 معاملة جديدة في قاعدة البيانات");

    const returnToMonthly = completion.getByRole("link", {
      name: "العودة إلى الإدخال الشهري",
    });
    await expect(returnToMonthly).toHaveAttribute("href", exactMonthlyHref);
    await expect(completion).toContainText(
      "ارجع إلى نفس شهر الإدخال الشهري بعد تحديث سجل المعاملات.",
    );
    await expectNoHorizontalOverflow(page);

    await returnToMonthly.click();

    await expect(page.getByRole("heading", { name: "الإدخال الشهري" })).toBeVisible();
    await expect(page.getByText("أغسطس ٢٠٢٦", { exact: true })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2026-08");
    await expect(importLink).toHaveAttribute("href", importHref);
    await expectNoHorizontalOverflow(page);

    expect(browserErrors).toEqual([]);
  });
});
