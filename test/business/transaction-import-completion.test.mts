import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parseTransactionImportCompletionSummary } from "../../src/lib/business/transaction-import-completion.ts";

const validPayload = {
  requested_token_count: 4,
  persisted_inserted_count: 3,
  session_unique_customer_count: 2,
  session_first_transaction_date: "2026-01-10",
  session_last_transaction_date: "2026-02-12",
  session_net_cash_collected: "80.2",
  business_transaction_count: 12,
  business_unique_customer_count: 7,
  business_first_transaction_date: "2025-11-01",
  business_last_transaction_date: "2026-02-12",
  business_net_cash_collected: "7500.25",
};

test("completion summary parser preserves exact decimal text and verified counts", () => {
  assert.deepEqual(parseTransactionImportCompletionSummary(validPayload), {
    requestedTokenCount: 4,
    persistedInsertedCount: 3,
    sessionUniqueCustomerCount: 2,
    sessionFirstTransactionDate: "2026-01-10",
    sessionLastTransactionDate: "2026-02-12",
    sessionNetCashCollected: "80.2",
    businessTransactionCount: 12,
    businessUniqueCustomerCount: 7,
    businessFirstTransactionDate: "2025-11-01",
    businessLastTransactionDate: "2026-02-12",
    businessNetCashCollected: "7500.25",
  });
});

test("completion summary parser accepts duplicate-only sessions without inventing session dates", () => {
  const parsed = parseTransactionImportCompletionSummary({
    ...validPayload,
    requested_token_count: 2,
    persisted_inserted_count: 0,
    session_unique_customer_count: 0,
    session_first_transaction_date: null,
    session_last_transaction_date: null,
    session_net_cash_collected: "0",
  });

  assert.ok(parsed);
  assert.equal(parsed.persistedInsertedCount, 0);
  assert.equal(parsed.sessionFirstTransactionDate, null);
  assert.equal(parsed.businessTransactionCount, 12);
});

test("completion summary parser fails closed on malformed or internally impossible payloads", () => {
  assert.equal(
    parseTransactionImportCompletionSummary({
      ...validPayload,
      persisted_inserted_count: 5,
      requested_token_count: 4,
    }),
    null,
  );
  assert.equal(
    parseTransactionImportCompletionSummary({
      ...validPayload,
      persisted_inserted_count: 0,
      session_unique_customer_count: 0,
      session_first_transaction_date: "2026-01-10",
      session_last_transaction_date: null,
      session_net_cash_collected: "0",
    }),
    null,
  );
  assert.equal(
    parseTransactionImportCompletionSummary({
      ...validPayload,
      business_net_cash_collected: 7500.25,
    }),
    null,
  );
});

test("import completion UX verifies persistence and links directly to Customers & LTV", () => {
  const importer = fs.readFileSync(
    "src/app/(app)/businesses/[businessId]/customers/import/transaction-import-validator.tsx",
    "utf8",
  );
  const completionCard = fs.readFileSync(
    "src/app/(app)/businesses/[businessId]/customers/import/transaction-import-completion-card.tsx",
    "utf8",
  );

  assert.match(importer, /transaction_import_completion_summary/);
  assert.match(importer, /persistedInsertedCount !== session\.expectedResult\.insertedCount/);
  assert.match(importer, /if \(pendingVerification\)/);
  assert.match(importer, /await finalizeVerification\(pendingVerification\)/);
  assert.match(importer, /TransactionImportCompletionCard/);
  assert.match(completionCard, /تم حفظ معاملاتك والتحقق منها/);
  assert.match(completionCard, /لم تتم إضافة معاملات جديدة/);
  assert.match(completionCard, /صفوف تفاصيل تم تجاهلها/);
  assert.match(completionCard, /صفوف غير صالحة/);
  assert.match(completionCard, /عرض تحليل العملاء/);
  assert.match(completionCard, /\/businesses\/\$\{businessId\}\/customers/);
});
