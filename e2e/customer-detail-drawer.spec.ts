import { expect, test, type Page, type Route } from "@playwright/test";
import { expectFullScreenMobileSheet } from "./mobile-sheet-assertions";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-profile, content-type, prefer, range-profile",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "http://127.0.0.1:3000",
  "Access-Control-Expose-Headers": "Content-Range",
};

const customerRow = {
  business_id: "00000000-0000-4000-8000-000000000067",
  customer_email: "buyer@example.com",
  customer_name: "Ahmed Buyer",
  acquisition_at: "2026-09-01T10:00:00+00:00",
  acquisition_date: "2026-09-01",
  transaction_count: 51,
  collection_count: 50,
  refund_count: 1,
  gross_cash_collected_text: "153",
  refunds_text: "25",
  net_cash_collected_text: "128",
  last_transaction_at: "2026-09-07T10:00:00+00:00",
  currency: "EGP",
};

const firstHistoryPage = [
  {
    id: "00000000-0000-4000-8000-000000000701",
    source: "stripe",
    source_transaction_id: "pi_refund_1",
    transaction_date: "2026-09-07",
    transaction_at: "2026-09-07T10:00:00+00:00",
    amount_collected: "25",
    transaction_type: "refund",
    currency: "EGP",
    revenue_stream_name_snapshot: "Backend Renewal",
    revenue_stream_type_snapshot: "backend",
    created_at: "2026-09-07T10:05:00+00:00",
  },
  {
    id: "00000000-0000-4000-8000-000000000702",
    source: "stripe",
    source_transaction_id: "pi_collection_1",
    transaction_date: "2026-09-01",
    transaction_at: "2026-09-01T10:00:00+00:00",
    amount_collected: "100",
    transaction_type: "collection",
    currency: "EGP",
    revenue_stream_name_snapshot: "Front-End Offer",
    revenue_stream_type_snapshot: "front_end",
    created_at: "2026-09-01T10:05:00+00:00",
  },
  ...Array.from({ length: 48 }, (_, index) => ({
    id: `fixture-page-one-${index}`,
    source: "stripe",
    source_transaction_id: `pi_fixture_${index}`,
    transaction_date: "2026-08-31",
    transaction_at: `2026-08-31T09:${String(index).padStart(2, "0")}:00+00:00`,
    amount_collected: "1",
    transaction_type: "collection",
    currency: "EGP",
    revenue_stream_name_snapshot: null,
    revenue_stream_type_snapshot: null,
    created_at: `2026-08-31T09:${String(index).padStart(2, "0")}:01+00:00`,
  })),
];

const secondHistoryPage = [
  {
    id: "00000000-0000-4000-8000-000000000799",
    source: "stripe",
    source_transaction_id: "pi_oldest_page_2",
    transaction_date: "2026-08-01",
    transaction_at: "2026-08-01T08:00:00+00:00",
    amount_collected: "5",
    transaction_type: "collection",
    currency: "EGP",
    revenue_stream_name_snapshot: "Older History",
    revenue_stream_type_snapshot: "other",
    created_at: "2026-08-01T08:05:00+00:00",
  },
];

/** Collects browser runtime failures while the drawer is opened, closed, and resized. */
function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** Fulfills one deterministic PostgREST request and handles the browser preflight. */
async function fulfillJson(route: Route, body: unknown[], contentRange?: string) {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: contentRange ? { ...corsHeaders, "Content-Range": contentRange } : corsHeaders,
    body: JSON.stringify(body),
  });
}

test.describe("N20 customer detail drawer", () => {
  test("shows complete paginated history without losing ledger URL state and restores focus", async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);
    const detailRequests: URL[] = [];
    let groupRequestCount = 0;

    await page.route("**/rest/v1/customer_transaction_groups**", async (route) => {
      groupRequestCount += 1;
      await fulfillJson(route, [customerRow], "50-50/100");
    });
    await page.route("**/rest/v1/customer_transactions**", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await fulfillJson(route, []);
        return;
      }

      const requestUrl = new URL(route.request().url());
      detailRequests.push(requestUrl);
      const offset = requestUrl.searchParams.get("offset") ?? "0";
      await fulfillJson(route, offset === "0" ? firstHistoryPage : secondHistoryPage);
    });

    await page.goto(
      "/auth/e2e-customer-name-search?view=customers&keep=1&filter=refunded&sort=net_cash_desc&customerPage=2",
    );
    await expect(page.getByText("Ahmed Buyer", { exact: true })).toBeVisible();
    const ledgerUrl = page.url();
    const initialGroupRequestCount = groupRequestCount;
    const trigger = page.getByRole("button", { name: "عرض تفاصيل العميل Ahmed Buyer" });

    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Ahmed Buyer" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "إغلاق تفاصيل العميل" })).toBeFocused();
    await expect(dialog.getByText("buyer@example.com", { exact: true })).toBeVisible();
    await expect(dialog.getByText("128 EGP", { exact: true })).toBeVisible();
    await expect(dialog.getByText("سجل المعاملات", { exact: true })).toBeVisible();
    await expect(dialog.getByText("-25 EGP", { exact: true })).toBeVisible();
    await expect(dialog.getByText("100 EGP", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Backend Renewal", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Front-End Offer", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Older History", { exact: true })).toBeVisible();
    await expect(dialog.getByText("51 معاملة", { exact: true })).toBeVisible();
    await expect.poll(() => detailRequests.length).toBe(2);
    expect(detailRequests.map((url) => url.searchParams.get("offset") ?? "0")).toEqual(["0", "50"]);
    expect(detailRequests.map((url) => url.searchParams.get("limit"))).toEqual(["50", "50"]);
    for (const requestUrl of detailRequests) {
      expect(requestUrl.searchParams.get("business_id")).toContain(customerRow.business_id);
      expect(requestUrl.searchParams.get("customer_email")).toContain("buyer@example.com");
    }
    expect(page.url()).toBe(ledgerUrl);
    expect(groupRequestCount).toBe(initialGroupRequestCount);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(page.url()).toBe(ledgerUrl);

    await page.setViewportSize({ width: 390, height: 844 });
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expectFullScreenMobileSheet(page, dialog);

    await page.getByRole("button", { name: "إغلاق تفاصيل العميل" }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(page.url()).toBe(ledgerUrl);
    expect(browserErrors).toEqual([]);
  });
});
