import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildTransactionImportHref,
  parseTransactionImportReturnOrigin,
  transactionImportReturnAction,
} from "../../src/lib/transaction-import-navigation.ts";

const importPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/import/page.tsx",
  "utf8",
);
const importActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/import/actions.ts",
  "utf8",
);
const importNavigationSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/import/transaction-import-navigation.tsx",
  "utf8",
);
const customerShellSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/customer-overview-shell.tsx",
  "utf8",
);
const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const completionSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/import/transaction-import-completion-card.tsx",
  "utf8",
);

test("builds Import URLs only from structured allow-listed origin metadata", () => {
  assert.equal(
    buildTransactionImportHref("business fixture/01", { origin: "customer-overview" }),
    "/businesses/business%20fixture%2F01/customers/import?origin=customer-overview",
  );
  assert.equal(
    buildTransactionImportHref("business fixture/01", {
      origin: "customer-profitability",
      month: "2026-08",
    }),
    "/businesses/business%20fixture%2F01/customers/import?origin=customer-profitability&month=2026-08",
  );
  assert.equal(
    buildTransactionImportHref(
      "business fixture/01",
      { origin: "monthly-editor", month: "2026-09" },
      "complete",
    ),
    "/businesses/business%20fixture%2F01/customers/import?origin=monthly-editor&month=2026-09&historyStatus=complete",
  );
  assert.equal(
    parseTransactionImportReturnOrigin({ origin: "funnel-structure" }),
    null,
  );
});

test("resolves Import completion and Cancel actions from the same safe origin", () => {
  assert.deepEqual(transactionImportReturnAction(null, "business/01"), {
    href: "/businesses/business%2F01/customers",
    label: "عرض تحليل العملاء",
    description:
      "افتح تحليل العملاء؛ العملاء وCohorts وObserved LTV تُقرأ من سجل المعاملات المحفوظ فعلًا.",
  });

  assert.deepEqual(
    transactionImportReturnAction(
      { origin: "customer-profitability", month: "2026-08" },
      "business/01",
    ),
    {
      href: "/businesses/business%2F01/customers?view=profitability&month=2026-08",
      label: "العودة إلى ربحية العميل",
      description: "ارجع إلى نفس سياق ربحية العميل بعد تحديث سجل المعاملات.",
    },
  );

  assert.deepEqual(
    transactionImportReturnAction(
      { origin: "monthly-editor", month: "2026-09" },
      "business/01",
    ),
    {
      href: "/businesses/business%2F01/monthly?month=2026-09",
      label: "العودة إلى الإدخال الشهري",
      description: "ارجع إلى نفس شهر الإدخال الشهري بعد تحديث سجل المعاملات.",
    },
  );
});

test("Import page uses breadcrumb plus origin-aware Cancel and keeps origin through status redirects", () => {
  assert.match(importPageSource, /TransactionImportNavigation/);
  assert.match(importPageSource, /parseTransactionImportReturnOrigin\(\{/);
  assert.match(importPageSource, /name="origin" value=\{returnOrigin\.origin\}/);
  assert.match(importPageSource, /name="month" value=\{returnOrigin\.month\}/);
  assert.match(importNavigationSource, /Breadcrumb/);
  assert.match(importNavigationSource, /إلغاء الاستيراد/);
  assert.match(importActionsSource, /formData\.getAll\(key\)/);
  assert.match(importActionsSource, /parseTransactionImportReturnOrigin\(\{/);
  assert.match(importActionsSource, /origin: readReturnMetadataField\(formData, "origin"\)/);
  assert.match(importActionsSource, /month: readReturnMetadataField\(formData, "month"\)/);
  assert.match(importActionsSource, /buildTransactionImportHref\(businessId, returnOrigin, historyStatus\)/);
  assert.doesNotMatch(importActionsSource, /formData\.get\("origin"\)/);
  assert.doesNotMatch(importActionsSource, /formData\.get\("month"\)/);
  assert.doesNotMatch(importPageSource, /returnTo/);
  assert.doesNotMatch(importActionsSource, /returnTo/);
});

test("Customer and exact Monthly entry points carry structured Import origins", () => {
  assert.match(customerShellSource, /buildTransactionImportHref\(businessId, importOrigin\)/);
  assert.match(customerShellSource, /origin: "customer-profitability"/);
  assert.match(customerShellSource, /origin: "customer-overview"/);
  assert.match(monthlyPageSource, /buildTransactionImportHref\(businessId, \{/);
  assert.match(monthlyPageSource, /origin: "monthly-editor"/);
  assert.match(monthlyPageSource, /month: selectedMonth\.monthKey/);
});

test("verified completion renders the provided origin-aware action with a safe fallback", () => {
  assert.match(completionSource, /returnAction \?\? transactionImportReturnAction\(null, businessId\)/);
  assert.match(completionSource, /href=\{nextAction\.href\}/);
  assert.match(completionSource, /\{nextAction\.label\}/);
  assert.doesNotMatch(completionSource, /returnTo/);
});
