import { expect, test } from "@playwright/test";

const PLANNER_BUSINESS_ID = "00000000-0000-4000-8000-000000000055";

/** Collects console and page errors so the N55 browser journey also guards runtime health. */
function captureBrowserErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Builds the canonical CI fixture URL for a valid originating Target Planner plan. */
function plannerContextUrl(extra = "") {
  return (
    "/auth/e2e-simulator?" +
    new URLSearchParams({
      origin: "target-planner",
      planner_business: PLANNER_BUSINESS_ID,
      planner_step: "plan",
      planner_goal: "net_profit",
      planner_value: "50000",
    }).toString() +
    extra
  );
}

/** Asserts that a Simulator URL retains the exact structured Target Planner origin. */
function expectPlannerContext(urlValue: string) {
  const url = new URL(urlValue);
  expect(url.searchParams.get("origin")).toBe("target-planner");
  expect(url.searchParams.get("planner_business")).toBe(PLANNER_BUSINESS_ID);
  expect(url.searchParams.get("planner_step")).toBe("plan");
  expect(url.searchParams.get("planner_goal")).toBe("net_profit");
  expect(url.searchParams.get("planner_value")).toBe("50000");
}

test.describe("N55 Target Planner to Simulator return context", () => {
  test("preserves exact planner context through Simulator navigation, refresh, Back, and mutation forms", async ({
    page,
  }) => {
    const browserErrors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(plannerContextUrl());

    const returnSection = page.getByRole("region", { name: "سياق العودة إلى خطة الهدف" });
    await expect(returnSection).toBeVisible();
    await expect(returnSection).toContainText("قيم خطة الهدف لا تُطبَّق على السيناريو تلقائيًا");

    const returnLink = page.getByRole("link", { name: "العودة إلى نفس خطوة خطة الهدف" });
    await expect(returnLink).toHaveAttribute(
      "href",
      `/target-plan?business=${PLANNER_BUSINESS_ID}&goal=net_profit&step=plan&value=50000`,
    );

    const saveForm = page
      .getByRole("button", { name: "حفظ السيناريو" })
      .locator("xpath=ancestor::form");
    await expect(saveForm.locator('input[name="origin"]')).toHaveValue("target-planner");
    await expect(saveForm.locator('input[name="planner_business"]')).toHaveValue(
      PLANNER_BUSINESS_ID,
    );
    await expect(saveForm.locator('input[name="planner_step"]')).toHaveValue("plan");
    await expect(saveForm.locator('input[name="planner_goal"]')).toHaveValue("net_profit");
    await expect(saveForm.locator('input[name="planner_value"]')).toHaveValue("50000");

    await page.getByRole("link", { name: "فتح سيناريو أ" }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("scenario"))
      .toBe("a");
    const scenarioUrl = new URL(page.url());
    expect(scenarioUrl.searchParams.get("scenario")).toBe("a");
    expectPlannerContext(page.url());

    await page.reload();
    await expect(returnSection).toBeVisible();

    await page.goBack();
    await expect(returnSection).toBeVisible();
    await expect(page.getByRole("link", { name: "العودة إلى نفس خطوة خطة الهدف" })).toHaveAttribute(
      "href",
      `/target-plan?business=${PLANNER_BUSINESS_ID}&goal=net_profit&step=plan&value=50000`,
    );

    await page.getByRole("link", { name: "فتح سيناريو أ" }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("scenario"))
      .toBe("a");

    await page.getByRole("button", { name: "حفظ التعديلات" }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("status"))
      .toBe("updated");
    expect(new URL(page.url()).searchParams.get("scenario")).toBe("a");
    expectPlannerContext(page.url());

    await page.getByRole("button", { name: "إنشاء نسخة" }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("status"))
      .toBe("duplicated");
    expect(new URL(page.url()).searchParams.get("scenario")).toBe("b");
    expectPlannerContext(page.url());

    await page.getByRole("button", { name: "حذف السيناريو" }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("status"))
      .toBe("deleted");
    expect(new URL(page.url()).searchParams.get("scenario")).toBeNull();
    expectPlannerContext(page.url());
    await expect(returnSection).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      )
      .toBe(true);

    expect(browserErrors).toEqual([]);
  });

  test("drops malformed or ambiguous planner context instead of propagating it", async ({ page }) => {
    await page.goto(
      plannerContextUrl("&planner_step=goal"),
    );

    await expect(
      page.getByRole("region", { name: "سياق العودة إلى خطة الهدف" }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "فتح سيناريو أ" })).toHaveAttribute(
      "href",
      "/auth/e2e-simulator?scenario=a",
    );

    await page.goto(
      "/auth/e2e-simulator?" +
        new URLSearchParams({
          origin: "target-planner",
          planner_business: "not-a-business",
          planner_step: "plan",
          planner_goal: "revenue",
          planner_value: "50000",
        }).toString(),
    );

    await expect(
      page.getByRole("region", { name: "سياق العودة إلى خطة الهدف" }),
    ).toHaveCount(0);
  });
});
