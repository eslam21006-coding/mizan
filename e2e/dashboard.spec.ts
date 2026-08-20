import { expect, test } from "@playwright/test";

const liveEmail = process.env.MIZAN_E2E_EMAIL?.trim() ?? "";
const livePassword = process.env.MIZAN_E2E_PASSWORD ?? "";
const liveInviteTokenHash = process.env.MIZAN_E2E_INVITE_TOKEN_HASH?.trim() ?? "";
const hasLiveAuth = Boolean(liveInviteTokenHash || (liveEmail && livePassword));
const requireLiveAuth = process.env.MIZAN_REQUIRE_AUTH_E2E === "true";

type MonthlyFixture = {
  month: string;
  frontGross: string;
  frontRefunds: string;
  backendGross: string;
  backendRefunds: string;
  newCustomers: string;
  payingCustomers: string;
  acquisition: string;
  fulfillmentPerCustomer: string;
  overhead: string;
  processorPercent: string;
};

async function login(page: import("@playwright/test").Page) {
  if (liveInviteTokenHash) {
    await page.goto(
      `/auth/confirm?token_hash=${encodeURIComponent(liveInviteTokenHash)}&type=invite`,
    );
    await expect(page).toHaveURL(/\/set-password$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    return;
  }

  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(liveEmail);
  await page.getByLabel("كلمة المرور").fill(livePassword);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function waitForSetupRow(page: import("@playwright/test").Page, name: string) {
  await expect(page.locator(`article input[name="name"][value="${name}"]`)).toBeVisible();
}

async function saveMonth(
  page: import("@playwright/test").Page,
  fixture: MonthlyFixture,
  names: {
    frontEnd: string;
    backend: string;
    acquisition: string;
    delivery: string;
    overhead: string;
    processor: string;
  },
) {
  await page.locator('input[type="month"][name="month"]').fill(fixture.month);
  await page.getByRole("button", { name: "فتح الشهر" }).click();
  await page.getByLabel(`الإيراد المحصل — ${names.frontEnd}`).fill(fixture.frontGross);
  await page.getByLabel(`المرتجعات — ${names.frontEnd}`).fill(fixture.frontRefunds);
  await page.getByLabel(`الإيراد المحصل — ${names.backend}`).fill(fixture.backendGross);
  await page.getByLabel(`المرتجعات — ${names.backend}`).fill(fixture.backendRefunds);
  await page.getByLabel("إيراد محصل غير موزع على مصدر").fill("0");
  await page.getByLabel("مرتجعات غير موزعة على مصدر").fill("0");
  await page.getByLabel("عملاء جدد").fill(fixture.newCustomers);
  await page.getByLabel("إجمالي العملاء الدافعين").fill(fixture.payingCustomers);
  await page.getByLabel(`${names.acquisition} — القيمة الشهرية`).fill(fixture.acquisition);
  await page
    .getByLabel(`${names.delivery} — التكلفة لكل عميل`)
    .fill(fixture.fulfillmentPerCustomer);
  await page
    .getByLabel(`أساس عدد العملاء — ${names.delivery}`)
    .selectOption("total_paying_customers");
  await page.getByLabel(`${names.overhead} — القيمة الشهرية`).fill(fixture.overhead);
  await page.getByLabel(`${names.processor} — النسبة %`).fill(fixture.processorPercent);
  await page.getByRole("button", { name: "حفظ الشهر" }).click();
  await expect(page.getByRole("status")).toContainText("تم حفظ بيانات الشهر");
}

test.describe("Task 11 dashboard, Task 12 comparison, and Task 13 historical analytics", () => {
  test.beforeAll(() => {
    if (requireLiveAuth && !hasLiveAuth) {
      throw new Error(
        "Authenticated dashboard E2E is required, but neither an invite token nor email/password credentials were provided.",
      );
    }
  });

  test.skip(
    !hasLiveAuth && !requireLiveAuth,
    "Requires live Mizan Supabase credentials or a one-use invite token",
  );

  test("renders monthly, comparison, Rolling 3, YTD, and custom analytics in Arabic RTL", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    const suffix = Date.now();
    const businessName = `داشبورد ${suffix}`;
    const frontEndName = `Front End ${suffix}`;
    const backendName = `Backend ${suffix}`;
    const adSpendName = `Ad Spend ${suffix}`;
    const deliveryName = `Delivery ${suffix}`;
    const rentName = `Rent ${suffix}`;
    const processorName = `Processor ${suffix}`;

    await login(page);
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto("/businesses/new");
    await page.getByLabel("اسم البزنس").fill(businessName);
    await page.getByLabel("اسم البزنس").press("Enter");
    await page.getByRole("button", { name: /EGP/ }).click();
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByLabel("المنطقة الزمنية").selectOption("Africa/Cairo");
    await page.getByRole("button", { name: "التالي" }).click();
    await page.getByRole("button", { name: "إنشاء البزنس" }).click();
    await expect(page).toHaveURL(/\/businesses\?status=created$/);

    let businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "إدارة مصادر الإيراد" }).click();

    await page.getByLabel("اسم مصدر الإيراد").fill(frontEndName);
    await page.getByLabel("التصنيف").first().selectOption("front_end");
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
    await waitForSetupRow(page, frontEndName);

    await page.getByLabel("اسم مصدر الإيراد").fill(backendName);
    await page.getByLabel("التصنيف").first().selectOption("backend");
    await page.getByRole("button", { name: "إضافة مصدر الإيراد" }).click();
    await waitForSetupRow(page, backendName);

    await page.getByRole("link", { name: "العودة للبزنسات" }).click();
    businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "إدارة المصروفات" }).click();

    for (const [name, category, behavior] of [
      [adSpendName, "acquisition", "fixed_monthly"],
      [deliveryName, "fulfillment", "per_customer"],
      [rentName, "overhead", "fixed_monthly"],
      [processorName, "financial", "percentage_revenue"],
    ] as const) {
      await page.getByLabel("اسم المصروف").fill(name);
      await page.getByLabel("التصنيف").first().selectOption(category);
      await page.getByLabel("طريقة التكلفة").first().selectOption(behavior);
      await page.getByRole("button", { name: "إضافة المصروف" }).click();
      await waitForSetupRow(page, name);
    }

    await page.getByRole("link", { name: "العودة للبزنسات" }).click();
    businessCard = page.locator("article").filter({ hasText: businessName });
    await businessCard.getByRole("link", { name: "الإدخال الشهري" }).click();
    await expect(page).toHaveURL(/\/businesses\/[^/]+\/monthly(?:\?.*)?$/);

    const businessIdMatch = /\/businesses\/([^/]+)\/monthly/.exec(new URL(page.url()).pathname);
    expect(businessIdMatch?.[1]).toBeTruthy();
    const businessId = businessIdMatch?.[1] ?? "";

    const names = {
      frontEnd: frontEndName,
      backend: backendName,
      acquisition: adSpendName,
      delivery: deliveryName,
      overhead: rentName,
      processor: processorName,
    };

    for (const fixture of [
      {
        month: "2026-01",
        frontGross: "5000",
        frontRefunds: "0",
        backendGross: "0",
        backendRefunds: "0",
        newCustomers: "5",
        payingCustomers: "5",
        acquisition: "1000",
        fulfillmentPerCustomer: "20",
        overhead: "500",
        processorPercent: "2",
      },
      {
        month: "2026-02",
        frontGross: "6000",
        frontRefunds: "0",
        backendGross: "1000",
        backendRefunds: "0",
        newCustomers: "7",
        payingCustomers: "8",
        acquisition: "1200",
        fulfillmentPerCustomer: "20",
        overhead: "600",
        processorPercent: "2",
      },
      {
        month: "2026-03",
        frontGross: "8000",
        frontRefunds: "0",
        backendGross: "2000",
        backendRefunds: "0",
        newCustomers: "10",
        payingCustomers: "10",
        acquisition: "2000",
        fulfillmentPerCustomer: "20",
        overhead: "1000",
        processorPercent: "3",
      },
      {
        month: "2026-04",
        frontGross: "10000",
        frontRefunds: "500",
        backendGross: "4000",
        backendRefunds: "0",
        newCustomers: "10",
        payingCustomers: "15",
        acquisition: "2000",
        fulfillmentPerCustomer: "20",
        overhead: "1000",
        processorPercent: "3.5",
      },
    ] satisfies MonthlyFixture[]) {
      await saveMonth(page, fixture, names);
    }

    await page.goto(`/?business=${encodeURIComponent(businessId)}&month=2026-04`);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "لوحة البزنس", level: 1 })).toBeVisible();

    const marginCard = page
      .locator("article")
      .filter({ has: page.getByText("هامش صافي الربح الحقيقي", { exact: true }) });
    const profitCard = page
      .locator("article")
      .filter({ has: page.getByText("صافي الربح الحقيقي", { exact: true }) });
    const ultimateCacCard = page
      .locator("article")
      .filter({ has: page.getByText("Ultimate CAC", { exact: true }) });
    const netCashCard = page
      .locator("article")
      .filter({ has: page.getByText("صافي الكاش المحصل", { exact: true }) });

    await expect(marginCard).toContainText("٧٢٫١%");
    await expect(profitCard).toContainText("٩٬٧٢٧٫٥ EGP");
    await expect(ultimateCacCard).toContainText("٣٧٧٫٢٥ EGP");
    await expect(netCashCard).toContainText("١٣٬٥٠٠ EGP");

    await page.goto(`/analytics?business=${encodeURIComponent(businessId)}&month=2026-04`);
    await expect(page.getByRole("heading", { name: "التحليلات المالية", level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "أبريل ٢٠٢٦ مقابل مارس ٢٠٢٦",
        level: 2,
      }),
    ).toBeVisible();

    const comparisonSection = page.locator('section[aria-label="مقارنة الشهر بالشهر السابق"]');
    const comparisonProfit = comparisonSection
      .locator("article")
      .filter({ has: page.getByText("صافي الربح الحقيقي", { exact: true }) });
    await expect(comparisonProfit).toContainText("٩٬٧٢٧٫٥ EGP");
    await expect(comparisonProfit).toContainText("٦٬٥٠٠ EGP");
    await expect(comparisonProfit).toContainText("↑ ٣٬٢٢٧٫٥ EGP (٤٩٫٧%)");

    const comparisonNetCash = comparisonSection
      .locator("article")
      .filter({ has: page.getByText("صافي الكاش المحصل", { exact: true }) });
    await expect(comparisonNetCash).toContainText("١٣٬٥٠٠ EGP");
    await expect(comparisonNetCash).toContainText("١٠٬٠٠٠ EGP");
    await expect(comparisonNetCash).toContainText("↑ ٣٬٥٠٠ EGP (٣٥%)");

    const comparisonUltimateCac = comparisonSection
      .locator("article")
      .filter({ has: page.getByText("Ultimate CAC", { exact: true }) });
    await expect(comparisonUltimateCac).toContainText("٣٧٧٫٢٥ EGP");
    await expect(comparisonUltimateCac).toContainText("٣٥٠ EGP");
    await expect(comparisonUltimateCac).toContainText("↑ ٢٧٫٢٥ EGP (٧٫٨%)");

    const comparisonMargin = comparisonSection
      .locator("article")
      .filter({ has: page.getByText("هامش صافي الربح الحقيقي", { exact: true }) });
    await expect(comparisonMargin).toContainText("٧٢٫١%");
    await expect(comparisonMargin).toContainText("٦٥%");
    await expect(comparisonMargin).toContainText("↑ ٧٫١ نقطة مئوية");

    const rollingSummary = page.locator('section[aria-label="ملخص التحليل التاريخي"]');
    await expect(rollingSummary.getByRole("heading", { name: /فبراير ٢٠٢٦.*أبريل ٢٠٢٦/ })).toBeVisible();
    await expect(rollingSummary).toContainText("٣٠٬٥٠٠ EGP");
    await expect(rollingSummary).toContainText("٢١٬١٢٧٫٥ EGP");
    await expect(rollingSummary).toContainText("٦٩٫٣%");
    await expect(rollingSummary).toContainText("٩٬٣٧٢٫٥ EGP");
    await expect(rollingSummary).toContainText("٢٧");
    await expect(rollingSummary).toContainText("٣٣");
    await expect(rollingSummary).toContainText("ليست عددًا فريدًا للعملاء عبر الفترة");

    await page.goto(
      `/analytics?business=${encodeURIComponent(businessId)}&month=2026-04&period=ytd`,
    );
    const ytdSummary = page.locator('section[aria-label="ملخص التحليل التاريخي"]');
    await expect(ytdSummary.getByRole("heading", { name: /يناير ٢٠٢٦.*أبريل ٢٠٢٦/ })).toBeVisible();
    await expect(ytdSummary).toContainText("٣٥٬٥٠٠ EGP");
    await expect(ytdSummary).toContainText("٢٤٬٤٢٧٫٥ EGP");
    await expect(ytdSummary).toContainText("٦٨٫٨%");

    await page.goto(
      `/analytics?business=${encodeURIComponent(businessId)}&month=2026-04&period=custom&start=2026-03&end=2026-04`,
    );
    const customSummary = page.locator('section[aria-label="ملخص التحليل التاريخي"]');
    await expect(customSummary.getByRole("heading", { name: /مارس ٢٠٢٦.*أبريل ٢٠٢٦/ })).toBeVisible();
    await expect(customSummary).toContainText("٢٣٬٥٠٠ EGP");
    await expect(customSummary).toContainText("١٦٬٢٢٧٫٥ EGP");
    await expect(customSummary).toContainText("٦٩٫١%");

    await expect(
      page.getByText("الفترات المخصصة في هذه النسخة تبدأ وتنتهي على حدود شهر كامل فقط", {
        exact: false,
      }),
    ).toBeVisible();

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
});
