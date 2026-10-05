import { expect, test, type Page } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";
const fixturePath = "/auth/e2e-business-setup";
const businessId = "123e4567-e89b-42d3-a456-426614174000";
const productionBase = `/businesses/${businessId}/setup`;
const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const hasLiveAuth = Boolean(liveEmail && livePassword);

/** Collects console and uncaught browser errors for one setup scenario. */
function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Verifies Arabic RTL and absence of page-level horizontal overflow. */
async function expectStableRtl(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    )
    .toBe(true);
}

/** Signs into a live Mizan environment using the dedicated reusable E2E account. */
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(liveEmail);
  await page.getByLabel("كلمة المرور").fill(livePassword);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Serves fixture HTML for production-shaped setup URLs while preserving the browser URL. */
async function routeProductionSetupToFixture(page: Page, fixtureCase: string) {
  await page.route("**/businesses/**/setup**", async (route) => {
    const requested = new URL(route.request().url());
    if (!requested.pathname.endsWith("/setup")) {
      await route.continue();
      return;
    }

    const fixture = new URL(fixturePath, requested.origin);
    fixture.searchParams.set("case", fixtureCase);
    const step = requested.searchParams.get("step");
    if (step) fixture.searchParams.set("step", step);
    const month = requested.searchParams.get("month");
    if (month) fixture.searchParams.set("month", month);
    const status = requested.searchParams.get("status");
    if (status) fixture.searchParams.set("status", status);

    const response = await route.fetch({ url: fixture.toString() });
    await route.fulfill({ response });
  });
}

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test.describe("B04 business setup shell", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows canonical 1/4 resume state and gates Next on incomplete revenue", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=empty&step=revenue`);

    await expect(page.getByRole("heading", { name: "أكمل إعداد البزنس" })).toBeVisible();
    await expect(page.getByText("1 من 4 خطوات مكتملة", { exact: true })).toBeVisible();

    const revenueStep = page.getByRole("link").filter({ hasText: "كيف يدخل المال؟" });
    await expect(revenueStep).toHaveAttribute("aria-current", "step");
    await expect(page.getByRole("button", { name: "التالي" })).toBeDisabled();
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("keeps out-of-order progress factual while resume still targets the first missing step", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?case=out-of-order&step=revenue`);

    await expect(page.getByText("3 من 4 خطوات مكتملة", { exact: true })).toBeVisible();
    await expect(page.getByRole("link").filter({ hasText: "كيف يدخل المال؟" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(page.getByRole("link").filter({ hasText: "أين يذهب المال؟" })).toContainText(
      "مكتملة",
    );
    await expect(page.getByRole("link").filter({ hasText: "أول شهر حقيقي" })).toContainText(
      "مكتملة",
    );
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("preserves copied deep URLs through refresh, Back, and Forward", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await routeProductionSetupToFixture(page, "complete");

    const revenueUrl = `${productionBase}?step=revenue`;
    const expensesUrl = `${productionBase}?step=expenses`;
    await page.goto(revenueUrl);
    await expect(page.getByRole("link").filter({ hasText: "كيف يدخل المال؟" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    await page.reload();
    await expect(page.getByRole("link").filter({ hasText: "كيف يدخل المال؟" })).toHaveAttribute(
      "aria-current",
      "step",
    );

    await page.getByRole("link").filter({ hasText: "أين يذهب المال؟" }).click();
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      expensesUrl,
    );
    await expect(page.getByRole("link").filter({ hasText: "أين يذهب المال؟" })).toHaveAttribute(
      "aria-current",
      "step",
    );

    await page.goBack();
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      revenueUrl,
    );
    await page.goForward();
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toBe(
      expensesUrl,
    );
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("renders the structural completion view without financial payoff metrics", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=complete`);

    await expect(page.getByRole("heading", { name: "إعداد البزنس مكتمل" })).toBeVisible();
    await expect(page.getByText("4 من 4 خطوات مكتملة", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "فتح البزنس" })).toBeVisible();
    await expect(page.getByText("Real Net Profit")).toHaveCount(0);
    await expect(page.getByText("Ultimate CAC")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("fails closed when readiness facts cannot be loaded", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=load-error&step=expenses`);

    await expect(
      page.getByRole("alert").filter({ hasText: "تعذر تحميل حالة إعداد البزنس" }),
    ).toContainText("تعذر تحميل حالة إعداد البزنس");
    await expect(page.getByText("حالة التقدم غير متاحة", { exact: true })).toBeVisible();
    await expect(page.getByText(/من 4 خطوات مكتملة/)).toHaveCount(0);
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });
});


test.describe("B06 Money-In setup", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows the name-only Money-In form without advanced classification", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=empty&step=revenue`);

    await expect(
      page.getByRole("heading", { name: "ما الذي تبيعُه أو تحصل منه على إيراد؟" }),
    ).toBeVisible();
    await expect(page.getByLabel("اسم المنتج أو الخدمة")).toBeVisible();
    await expect(page.getByRole("button", { name: "إضافة مصدر الإيراد" })).toBeVisible();
    await expect(page.getByText("Front-End")).toHaveCount(0);
    await expect(page.getByText("Backend")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "التالي" })).toBeDisabled();
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("inactive-only sources remain visible without completing Revenue", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=inactive-only&step=revenue`);

    await expect(page.getByText("عرض قديم", { exact: true })).toBeVisible();
    await expect(page.getByText("غير نشط", { exact: true })).toBeVisible();
    await expect(page.getByText("1 من 4 خطوات مكتملة", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "التالي" })).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test("multiple active sources keep Revenue complete and Next targets Expenses at 390px", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await routeProductionSetupToFixture(page, "multiple");
    await page.goto(`${productionBase}?step=revenue`);

    await expect(page.getByText("2 من 4 خطوات مكتملة", { exact: true })).toBeVisible();
    await expect(page.getByText("الكورس الأساسي", { exact: true })).toBeVisible();
    await expect(page.getByText("VIP", { exact: true })).toBeVisible();
    await expect(page.getByText("Mastermind", { exact: true })).toBeVisible();

    const next = page.getByRole("link", { name: "التالي" });
    await expect(next).toHaveAttribute(
      "href",
      `/businesses/${businessId}/setup?step=expenses`,
    );
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("read-only members can inspect sources without mutation controls", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=revenue&step=revenue`);

    await expect(page.getByText("الكورس الأساسي", { exact: true })).toBeVisible();
    await expect(page.getByText("عرض فقط", { exact: true })).toBeVisible();
    await expect(page.getByLabel("اسم المنتج أو الخدمة")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "إضافة مصدر الإيراد" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});



test.describe("B07 Expense Category UX", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("groups existing expenses under four guided categories and keeps explicit Next gated", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=expenses-mixed&step=expenses`);

    for (const heading of [
      "الإعلان وجلب العملاء",
      "تقديم الخدمة للعملاء",
      "تشغيل البزنس",
      "تكاليف مالية",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }

    await expect(
      page
        .locator('section[aria-labelledby="setup-expense-acquisition"] li > span')
        .filter({ hasText: /^Meta Ads$/ }),
    ).toBeVisible();
    await expect(page.getByText("Zoom", { exact: true })).toBeVisible();
    await expect(
      page.getByText("ليس لدي مصروف من هذا النوع", { exact: true }),
    ).toHaveCount(2);
    await expect(page.getByRole("button", { name: "تأكيد مراجعة المصروفات" })).toBeVisible();
    await expect(page.getByRole("button", { name: "التالي" })).toBeDisabled();

    const noneChoices = page.getByRole("checkbox");
    await expect(noneChoices).toHaveCount(2);
    await noneChoices.nth(0).check();
    await noneChoices.nth(1).check();
    await expect(noneChoices.nth(0)).toBeChecked();
    await expect(noneChoices.nth(1)).toBeChecked();

    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("inactive-only expenses remain visible and still require explicit none at 390px", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?case=expenses-inactive-only&step=expenses`);

    await expect(
      page.getByText(
        "بوابة دفع قديمة جدًا باسم طويل لاختبار الالتفاف على شاشة الموبايل",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByText("غير نشط", { exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(4);
    await expect(page.getByRole("button", { name: "التالي" })).toBeDisabled();

    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("reviewed-none state is canonical and enables explicit advance to First Month", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=expenses-reviewed-none&step=expenses`);

    await expect(
      page.getByText("تمت المراجعة — لا يوجد مصروف من هذا النوع", { exact: true }),
    ).toHaveCount(4);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "تأكيد مراجعة المصروفات" })).toHaveCount(0);

    const next = page.getByRole("link", { name: "التالي" });
    await expect(next).toHaveAttribute(
      "href",
      `/businesses/${businessId}/setup?step=month`,
    );
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("read-only users can inspect expense structure without any mutation controls", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=expenses-read-only&step=expenses`);

    await expect(page.getByText("عرض فقط", { exact: true })).toBeVisible();
    await expect(
      page
        .locator('section[aria-labelledby="setup-expense-acquisition"] li > span')
        .filter({ hasText: /^Meta Ads$/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "إضافة مصروف" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^حذف المصروف/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "تعديل", exact: true })).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "تأكيد مراجعة المصروفات" })).toHaveCount(0);
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });


  test("inline expense delete confirms, edit can disable, and controls fit mobile RTL", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?case=expenses-mixed&step=expenses`);

    const acquisition = page.locator('section[aria-labelledby="setup-expense-acquisition"]');
    const item = acquisition.locator('li[class*="expenseSetupItem"]').filter({ hasText: "Meta Ads" });
    const deleteButton = item.getByRole("button", { name: "حذف المصروف Meta Ads" });
    await expect(deleteButton).toBeVisible();
    await expect(item.getByRole("button", { name: "تعديل" })).toBeVisible();
    await expect(item.locator('input[name="destination"][value="setup"]')).toHaveCount(2);

    let promptShown = false;
    page.once("dialog", async (dialog) => {
      promptShown = true;
      expect(dialog.message()).toContain("Meta Ads");
      await dialog.dismiss();
    });
    await deleteButton.click();
    expect(promptShown).toBe(true);
    await expect(item).toBeVisible();

    await item.getByRole("button", { name: "تعديل" }).click();
    const editor = page.getByRole("dialog");
    await expect(editor).toBeVisible();
    await expect(editor.locator('input[name="destination"]')).toHaveValue("setup");
    const active = editor.getByRole("checkbox", { name: /المصروف نشط/ });
    await expect(active).toBeChecked();
    await active.uncheck();
    await expect(active).not.toBeChecked();
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("setup reuses the existing expense drawer with the category locked", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=expenses-mixed&step=expenses`);

    const acquisitionCard = page.locator(
      'section[aria-labelledby="setup-expense-acquisition"]',
    );
    await acquisitionCard.getByRole("button", { name: "إضافة مصروف" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("الإعلان وجلب العملاء", { exact: true })).toBeVisible();
    const behavior = dialog.getByLabel("كيف تُحسب هذه التكلفة؟");
    await expect(behavior.locator("option")).toHaveText([
      "مبلغ ثابت تقريبًا",
      "تزيد مع عدد العملاء",
      "نسبة من الإيراد",
    ]);
    await expect(behavior).toHaveValue("fixed_monthly");
    await expect(dialog.getByRole("combobox")).toHaveCount(1);
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });
});


test.describe("B09 first-month wizard shell", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("new month shows unsaved Monthly inputs and never marks the wizard complete", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=month-empty&step=month&month=2026-09`);
    const preview = page.getByLabel("إدخال أول شهر");

    await expect(preview.getByRole("heading", { name: "الإيرادات والمرتجعات" })).toBeVisible();
    await expect(preview.getByRole("heading", { name: "العملاء", exact: true })).toBeVisible();
    await expect(preview.getByRole("heading", { name: "المصاريف", exact: true })).toBeVisible();
    await expect(preview.getByLabel("الإيراد المحصل — الكورس الأساسي")).toHaveValue("");
    await expect(preview.getByLabel("المرتجعات — الكورس الأساسي")).toHaveValue("");
    await expect(preview.getByLabel("Meta Ads — القيمة الشهرية")).toHaveValue("");
    await expect(preview.getByLabel("Coach — التكلفة لكل عميل")).toHaveValue("");
    await expect(preview.getByLabel("بوابة الدفع — النسبة %")).toHaveValue("");
    await expect(page.getByText("احفظ أرقامك مباشرة من هذه الخطوة", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "حفظ الشهر" })).toBeVisible();
    await expect(page.getByRole("link", { name: "فتح الإدخال الشهري" }))
      .toHaveAttribute("href", `/businesses/${businessId}/monthly?month=2026-09`);
    await expect(page.getByRole("button", { name: "إنهاء الإعداد" })).toBeDisabled();

    await preview.getByLabel("الإيراد المحصل — الكورس الأساسي").fill("5000");
    await page.reload();
    await expect(preview.getByLabel("الإيراد المحصل — الكورس الأساسي")).toHaveValue("");
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("month selection preserves the URL on reload and supports browser Back", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await routeProductionSetupToFixture(page, "month-empty");
    await page.goto(`${fixturePath}?case=month-empty&step=month&month=2026-09`);
    await page.locator("#first-month-selection").fill("2026-08");
    await page.getByRole("button", { name: "فتح الشهر" }).click();
    await expect(page).toHaveURL(
      `/businesses/${businessId}/setup?step=month&month=2026-08`,
    );
    await expect(page.locator("#first-month-selection")).toHaveValue("2026-08");
    await expect(page.getByText("هذا الشهر غير محفوظ بعد", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator("#first-month-selection")).toHaveValue("2026-08");
    await page.goBack();
    await expect(page.locator("#first-month-selection")).toHaveValue("2026-09");
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("partial month retains zero and supports derived paying/manual new customers", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=month-partial&step=month&month=2026-10`);
    const preview = page.getByLabel("إدخال أول شهر");
    await expect(preview.getByLabel("الإيراد المحصل — الكورس الأساسي")).toHaveValue("5000");
    await expect(preview.getByLabel("المرتجعات — الكورس الأساسي")).toHaveValue("200");
    await expect(preview.getByLabel("المرتجعات — VIP")).toHaveValue("0");
    await expect(preview.getByLabel("عملاء جدد")).toHaveValue("");
    await expect(preview.locator('input[name="total_paying_customers"][type="hidden"]')).toHaveValue("35");
    await expect(preview.getByText("35", { exact: true })).toBeVisible();
    await expect(preview.getByLabel("Meta Ads — القيمة الشهرية")).toHaveValue("1500");
    await expect(preview.getByLabel("Coach — التكلفة لكل عميل")).toHaveValue("20");
    await expect(preview.getByLabel("بوابة الدفع — النسبة %")).toHaveValue("3");
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("saved historical snapshots render read-only at 390px RTL", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?case=month-saved&step=month&month=2026-09`);
    const preview = page.getByLabel("معاينة إدخال أول شهر");
    await expect(page.getByText("شهر تاريخي محفوظ — عرض فقط")).toBeVisible();
    await expect(preview.getByText("VIP — اسم محفوظ من شهر سابق", { exact: true }).first()).toBeVisible();
    await expect(preview.getByText("رسوم بوابة قديمة — تاريخ محفوظ", { exact: true }).first()).toBeVisible();
    await expect(preview.locator("input")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "إنهاء الإعداد" }))
      .toHaveAttribute("href", `/businesses/${businessId}/setup`);
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("read-only access and failed monthly reads do not expose mutations or fabricated values", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=month-read-only&step=month&month=2026-09`);
    await expect(page.getByLabel("معاينة إدخال أول شهر").locator("input")).toHaveCount(0);
    await expect(page.getByText("لا تملك صلاحية تعديل البيانات")).toBeVisible();

    await page.goto(`${fixturePath}?case=month-load-error&step=month&month=2026-09`);
    await expect(page.getByRole("alert").filter({ hasText: "تعذر تحميل بيانات هذا الشهر كاملة" })).toBeVisible();
    await expect(page.getByLabel("معاينة إدخال أول شهر")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "إنهاء الإعداد" })).toBeDisabled();
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("390px editable preview keeps three expense behaviors within the viewport", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?case=month-empty&step=month&month=2026-09`);
    const preview = page.getByLabel("إدخال أول شهر");
    await expect(preview.getByLabel("Meta Ads — القيمة الشهرية")).toBeVisible();
    await expect(preview.getByLabel("Coach — التكلفة لكل عميل")).toBeVisible();
    await expect(preview.getByLabel("بوابة الدفع — النسبة %")).toBeVisible();
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });
});


test.describe("B12A.1 deterministic resume month", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("resumes the latest saved incomplete month and keeps it after refresh", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=month-resume-partial&step=month`);

    await expect(page.locator("#first-month-selection")).toHaveValue("2026-09");
    await expect(
      page.getByText("التغييرات التي لم تحفظها لا تُستعاد تلقائيًا.", { exact: false }),
    ).toBeVisible();

    await page.reload();
    await expect(page.locator("#first-month-selection")).toHaveValue("2026-09");
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("uses the business current month when no incomplete saved month exists", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=month-empty&step=month`);

    await expect(page.locator("#first-month-selection")).toHaveValue("2026-10");
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("complete saved history falls back to current month without fabricating a saved current month", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=month-saved&step=month`);

    await expect(page.locator("#first-month-selection")).toHaveValue("2026-10");
    await expect(page.getByText("هذا الشهر غير محفوظ بعد", { exact: true })).toBeVisible();
    await expect(page.getByText("شهر تاريخي محفوظ — عرض فقط", { exact: true })).toHaveCount(0);
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("keeps an explicit valid month instead of replacing it with the resume month", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=month-resume-partial&step=month&month=2026-08`);

    await expect(page.locator("#first-month-selection")).toHaveValue("2026-08");
    await page.reload();
    await expect(page.locator("#first-month-selection")).toHaveValue("2026-08");
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });
});


test.describe("B10 first-month save UX", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("new Setup draft permits an untouched per-customer basis without losing server validation", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/auth/e2e-business-setup?case=month-empty&step=month&month=2026-10");

    const editor = page.getByLabel("إدخال أول شهر");
    const basis = editor.getByLabel("أساس عدد العملاء — Coach");
    await expect(basis).toHaveValue("");
    await expect(basis).not.toHaveAttribute("required");
    await editor.getByLabel("الإيراد المحصل — الكورس الأساسي").fill("5000");
    await editor.getByLabel("Coach — التكلفة لكل عميل").fill("20");
    await expect(page.getByRole("button", { name: "حفظ الشهر" })).toBeEnabled();
    await expect
      .poll(() => page.locator("form").filter({ has: editor }).evaluate((form: HTMLFormElement) => form.checkValidity()))
      .toBe(true);
    await expect(page.getByRole("button", { name: "إنهاء الإعداد" })).toBeDisabled();
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("saving a partial month reports persisted draft without falsely completing Setup", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto("/auth/e2e-business-setup?case=month-partial&step=month&month=2026-10&status=saved");

    await expect(page.getByText(
      "تم حفظ بيانات الشهر. ما زالت بعض الأرقام مطلوبة قبل اكتمال هذه الخطوة.",
      { exact: true },
    )).toBeVisible();
    await expect(page.getByText("الشهر محفوظ لكنه غير مكتمل ماليًا.", { exact: false })).toBeVisible();
    await expect(page.getByText("3 من 4 خطوات مكتملة", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "إنهاء الإعداد" })).toBeDisabled();
    const editor = page.getByLabel("إدخال أول شهر");
    await expect(editor.getByLabel("الإيراد المحصل — الكورس الأساسي")).toHaveValue("5000");
    await expect(editor.getByLabel("المرتجعات — VIP")).toHaveValue("0");
    await expect(editor.getByLabel("عملاء جدد")).toHaveValue("");
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("a copied saved-status URL never claims an unsaved month was persisted", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto("/auth/e2e-business-setup?case=month-empty&step=month&month=2026-10&status=saved");

    await expect(page.getByText("هذا الشهر غير محفوظ بعد", { exact: true })).toBeVisible();
    await expect(page.getByText("تم حفظ الشهر بنجاح، وأصبحت بياناته مكتملة.", { exact: true })).toHaveCount(0);
    await expect(page.getByText("تم حفظ بيانات الشهر. ما زالت بعض الأرقام مطلوبة قبل اكتمال هذه الخطوة.", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "إنهاء الإعداد" })).toBeDisabled();
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("saved complete month enables Finish only after canonical readiness", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto("/auth/e2e-business-setup?case=month-complete&step=month&month=2026-10&status=saved");

    await expect(page.getByText(
      "تم حفظ الشهر بنجاح، وأصبحت بياناته مكتملة.",
      { exact: true },
    )).toBeVisible();
    await expect(page.getByText("4 من 4 خطوات مكتملة", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "إنهاء الإعداد" }))
      .toHaveAttribute("href", ["/businesses", businessId, "setup"].join("/"));
    await expect(page.getByLabel("إدخال أول شهر").getByLabel("بوابة الدفع — النسبة %")).toHaveValue("3");
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("B11.4 partial save stays on the exact month without a result handoff", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?case=month-partial&step=month&month=2026-10&status=saved`);
    await expect(page.getByText("3 من 4 خطوات مكتملة")).toBeVisible();
    await expect(page.getByRole("link", { name: "إنهاء الإعداد" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "جاهز — ميزان فهم البزنس" })).toHaveCount(0);
    await expect(page.getByLabel("إدخال أول شهر").getByLabel("الإيراد المحصل — الكورس الأساسي")).toHaveValue("5000");
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("B11.4 saved month with missing other setup gives an accurate next step", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=month-setup-pending&step=month&month=2026-10&status=setup-incomplete`);
    await expect(page.getByText("3 من 4 خطوات مكتملة")).toBeVisible();
    await expect(page.getByText("تم حفظ الشهر والتحقق من اكتماله.")).toBeVisible();
    await expect(page.getByText("لا تزال هناك خطوة أخرى في إعداد البزنس تحتاج إلى إكمال قبل عرض النتائج.")).toBeVisible();
    await expect(page.getByRole("link", { name: "أكمل خطوات الإعداد" }))
      .toHaveAttribute("href", `/businesses/${businessId}/setup`);
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("B11.4 verified write with incomplete calculations directs current vs historical correction", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixturePath}?case=month-complete&step=month&month=2026-10&status=result-unavailable`);
    await expect(page.getByText("تم الحفظ، لكن نتيجة الشهر غير جاهزة بعد.")).toBeVisible();
    await expect(page.getByText(/المبالغ غير المنسوبة/)).toBeVisible();
    await expect(page.getByRole("link", { name: "مراجعة بيانات الشهر" }))
      .toHaveAttribute("href", `/businesses/${businessId}/monthly?month=2026-10`);
    await expectStableRtl(page);

    await page.goto(`${fixturePath}?case=month-saved&step=month&month=2026-09&status=result-unavailable`);
    await expect(page.getByRole("link", { name: "مراجعة بيانات الشهر" }))
      .toHaveAttribute("href", `/businesses/${businessId}/monthly/correction?month=2026-09`);
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("B11.4 verification failure after saving does not claim financial completeness", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=month-complete&step=month&month=2026-10&status=verification-unavailable`);
    await expect(page.getByText(/الشهر محفوظ، لكن تعذر التحقق من جاهزية النتيجة/)).toBeVisible();
    await expect(page.getByText("تم حفظ الشهر بنجاح، وأصبحت بياناته مكتملة.")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "جاهز — ميزان فهم البزنس" })).toHaveCount(0);
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("B11.4 manually changing a status URL never turns an unsaved or partial month into verified success", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.goto(`${fixturePath}?case=month-empty&step=month&month=2026-10&status=setup-incomplete`);
    await expect(page.getByText("هذا الشهر غير محفوظ بعد")).toBeVisible();
    await expect(page.getByText("تم حفظ الشهر والتحقق من اكتماله.")).toHaveCount(0);

    await page.goto(`${fixturePath}?case=month-complete&step=month&month=2026-10&status=setup-incomplete`);
    await expect(page.getByText("4 من 4 خطوات مكتملة")).toBeVisible();
    await expect(page.getByText("تم حفظ الشهر والتحقق من اكتماله.")).toHaveCount(0);
    await expect(page.getByText("تم حفظ الشهر بنجاح، وأصبحت بياناته مكتملة.")).toBeVisible();

    await page.goto(`${fixturePath}?case=month-partial&step=month&month=2026-10&status=result-unavailable`);
    await expect(page.getByText("3 من 4 خطوات مكتملة")).toBeVisible();
    await expect(page.getByText("تم الحفظ، لكن نتيجة الشهر غير جاهزة بعد.")).toHaveCount(0);
    await expect(page.getByText(/تم حفظ بيانات الشهر. ما زالت بعض الأرقام مطلوبة/)).toBeVisible();

    await page.goto(`${fixturePath}?case=month-empty&step=month&month=2026-10&status=verification-unavailable`);
    await expect(page.getByText("تعذر تأكيد حالة الحفظ. أعد تحميل الصفحة للتحقق من البيانات، ولن نعرض نتائج غير مؤكدة.")).toBeVisible();
    await expect(page.getByText("تم حفظ الشهر بنجاح، وأصبحت بياناته مكتملة.")).toHaveCount(0);
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });

  test("field errors keep submitted monetary values and identify the missing basis", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/auth/e2e-business-setup?case=month-error&step=month&month=2026-10");
    const editor = page.getByLabel("إدخال أول شهر");

    await expect(page.getByRole("alert").filter({ hasText: "راجع الحقول المحددة" })).toBeVisible();
    await expect(editor.getByLabel("الإيراد المحصل — الكورس الأساسي")).toHaveValue("5000");
    await expect(editor.getByLabel("Coach — التكلفة لكل عميل")).toHaveValue("20");
    const basis = editor.getByLabel("أساس عدد العملاء — Coach");
    await expect(basis).toHaveAttribute("aria-invalid", "true");
    await expect(editor.getByRole("alert").filter({ hasText: "اختر أساس عدد العملاء" })).toBeVisible();
    await basis.selectOption("total_paying_customers");
    await expect(basis).toHaveValue("total_paying_customers");
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });
});

test.describe("B10 authenticated save validation", () => {
  test.skip(!hasLiveAuth, "Requires the dedicated Mizan E2E email/password account");

  test("submitting a cost without its per-customer basis preserves entered amounts", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    const suffix = Date.now();
    const sourceName = `B10 course ${suffix}`;
    const coachName = `B10 coach ${suffix}`;

    await login(page);
    await page.goto("/businesses/new");
    await page.getByLabel("اسم البزنس").fill(`B10 validation ${suffix}`);
    await page.getByRole("button", { name: /EGP/ }).click();
    await page.getByRole("button", { name: "إنشاء البزنس والمتابعة" }).click();
    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]+\/setup\?step=revenue$/);
    const businessId = page.url().match(/\/businesses\/([0-9a-f-]+)\/setup/)?.[1];
    expect(businessId).toBeTruthy();

    await page.getByLabel("اسم المنتج أو الخدمة").fill(sourceName);
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
    await page.goto(`/businesses/${businessId}/setup?step=expenses`);
    const fulfillment = page.locator('section[aria-labelledby="setup-expense-fulfillment"]');
    await fulfillment.getByRole("button", { name: "إضافة مصروف" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByLabel("اسم المصروف").fill(coachName);
    await drawer.getByLabel("كيف تُحسب هذه التكلفة؟").selectOption("per_customer");
    await drawer.getByRole("button", { name: "إضافة المصروف" }).click();
    await expect(page.getByText(coachName, { exact: true })).toBeVisible();

    await page.goto(`/businesses/${businessId}/setup?step=month`);
    const editor = page.getByLabel("إدخال أول شهر");
    await editor.getByLabel(`الإيراد المحصل — ${sourceName}`).fill("5000");
    await editor.getByLabel(`المرتجعات — ${sourceName}`).fill("0");
    await editor.getByLabel("عملاء جدد").fill("10");
    await editor.getByLabel("إجمالي العملاء الذين دفعوا خلال الشهر").fill("10");
    await editor.getByLabel(`${coachName} — التكلفة لكل عميل`).fill("20");
    await expect(editor.getByLabel(`أساس عدد العملاء — ${coachName}`)).toHaveValue("");

    await page.getByRole("button", { name: "حفظ الشهر" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "راجع الحقول المحددة" })).toBeVisible();
    await expect(editor.getByRole("alert").filter({ hasText: "اختر أساس عدد العملاء" })).toBeVisible();
    await expect(editor.getByLabel(`الإيراد المحصل — ${sourceName}`)).toHaveValue("5000");
    await expect(editor.getByLabel(`${coachName} — التكلفة لكل عميل`)).toHaveValue("20");
    await expect(page.getByRole("button", { name: "إنهاء الإعداد" })).toBeDisabled();
    await expectStableRtl(page);
    expect(errors).toEqual([]);
  });
});

test.describe("B06 live Money-In handoff", () => {
  test.skip(!hasLiveAuth, "Requires the dedicated Mizan E2E email/password account");

  test("adds Revenue in setup, stays on Revenue, then advances explicitly to Expenses", async ({
    page,
  }) => {
    const errors = captureBrowserErrors(page);
    const suffix = Date.now();
    const businessName = `بزنس B06 ${suffix}`;
    const firstSource = `الكورس الأساسي ${suffix}`;
    const secondSource = `VIP ${suffix}`;

    await login(page);
    await page.goto("/businesses/new");
    await page.getByLabel("اسم البزنس").fill(businessName);
    await page.getByRole("button", { name: /EGP/ }).click();
    await page.getByRole("button", { name: "إنشاء البزنس والمتابعة" }).click();
    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]+\/setup\?step=revenue$/);
    await expect(page.getByText("1 من 4 خطوات مكتملة", { exact: true })).toBeVisible();

    await page.getByLabel("اسم المنتج أو الخدمة").fill(firstSource);
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
    await expect(page).toHaveURL(
      /\/businesses\/[0-9a-f-]+\/setup\?step=revenue&status=created$/,
    );
    await expect(page.getByText(firstSource, { exact: true })).toBeVisible();
    await expect(page.getByText("2 من 4 خطوات مكتملة", { exact: true })).toBeVisible();

    await page.getByLabel("اسم المنتج أو الخدمة").fill(secondSource);
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
    await expect(page.getByText(secondSource, { exact: true })).toBeVisible();
    await expect(page.getByText("2 من 4 خطوات مكتملة", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "التالي" }).click();
    await expect(page).toHaveURL(/\/businesses\/[0-9a-f-]+\/setup\?step=expenses$/);
    expect(errors).toEqual([]);
  });
});
