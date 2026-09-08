import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ledger = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/customers/customer-groups-table.tsx",
    import.meta.url,
  ),
  "utf8",
);
const migration = await readFile(
  new URL(
    "../../supabase/migrations/20260908173000_customer_name_email_search.sql",
    import.meta.url,
  ),
  "utf8",
);

test("customer ledger searches the protected name-or-email projection while retaining literal ILIKE escaping", () => {
  assert.match(ledger, /\.ilike\("customer_search_text", `%\$\{escapeIlikeLiteral\(search\)\}%`\)/);
  assert.match(ledger, /ابحث بالاسم أو البريد الإلكتروني/);
  assert.match(ledger, /id="customer-search"/);
  assert.match(ledger, /dir="auto"/);
  assert.match(ledger, /replaceAll\("\\\\", "\\\\\\\\"\)/);
  assert.match(ledger, /replaceAll\("%", "\\\\%"\)/);
  assert.match(ledger, /replaceAll\("_", "\\\\_"\)/);
  assert.match(ledger, /كل بريد إلكتروني يمثل عميلًا واحدًا داخل هذا البزنس/);
});

test("customer search migration preserves invoker security and keeps search metadata separate from identity", () => {
  assert.match(migration, /with \(security_invoker = true, security_barrier = true\)/);
  assert.match(migration, /group by transaction\.business_id, transaction\.customer_email/);
  assert.match(migration, /concat_ws\(' ', customer_name, customer_email\) as customer_search_text/);
  assert.match(migration, /It is not a customer identity key/);
  assert.match(migration, /revoke all on public\.customer_transaction_groups from anon/);
  assert.match(migration, /grant select on public\.customer_transaction_groups to authenticated/);
});
