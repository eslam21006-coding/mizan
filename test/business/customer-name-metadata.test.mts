import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeTransactionCustomerName, TRANSACTION_CUSTOMER_NAME_MAX_LENGTH } from "../../src/lib/business/transaction-import-validation.ts";
import { prepareTransactionImportRows } from "../../src/lib/business/transaction-import.ts";

test("customer name is optional display metadata and does not change email identity", () => {
  assert.equal(normalizeTransactionCustomerName("  Ahmed Buyer  "), "Ahmed Buyer");
  assert.equal(normalizeTransactionCustomerName("   "), null);
  assert.equal(normalizeTransactionCustomerName("x".repeat(TRANSACTION_CUSTOMER_NAME_MAX_LENGTH + 1)), null);
  const rows = prepareTransactionImportRows([{ rowNumber: 1, customerEmail: " Buyer@Example.com ", customerName: " Ahmed Buyer ", transactionDate: "2026-09-08", amountCollected: "100", transactionId: "txn-name-1" }], { transactionType: "collection", baseCurrency: "EGP", createImportRowToken: () => "66666666-6666-4666-8666-666666666001" });
  assert.equal(rows[0]?.customer_email, "buyer@example.com");
  assert.equal(rows[0]?.customer_name, "Ahmed Buyer");
});


test("optional customer-name persistence cannot block a committed financial import", async () => {
  const source = await readFile(
    "src/app/(app)/businesses/[businessId]/customers/import/transaction-import-validator.tsx",
    "utf8",
  );
  const confirmedBeforeMetadata = source.indexOf("confirmed = {");
  const metadataRpc = source.indexOf('supabase.rpc("apply_customer_transaction_names"');
  assert.ok(confirmedBeforeMetadata >= 0 && metadataRpc > confirmedBeforeMetadata);
  assert.match(source, /if \(chunk\.some\(\(row\) => row\.customer_name\)\)/);
  assert.match(source, /if \(nameError\) \{[\s\S]*?setNameImportWarning/);
  assert.doesNotMatch(source, /if \(nameError\) throw new TransactionImportProcessError/);
});
