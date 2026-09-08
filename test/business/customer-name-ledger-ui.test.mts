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

test("customer ledger renders optional name while retaining email fallback identity", () => {
  assert.match(ledger, /customer_name: string \| null/);
  assert.match(ledger, /<th scope="col">العميل<\/th>/);
  assert.match(ledger, /row\.customer_name \?/);
  assert.match(ledger, /<strong>\{row\.customer_name\}<\/strong>/);
  assert.match(ledger, /<strong dir="ltr">\{row\.customer_email\}<\/strong>/);
});
