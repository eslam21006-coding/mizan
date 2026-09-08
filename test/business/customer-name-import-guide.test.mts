import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/customers/import/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const template = await readFile(
  new URL("../../public/mizan-transactions-template.csv", import.meta.url),
  "utf8",
);

test("customer name is documented as optional display-only import metadata", () => {
  assert.match(page, /اسم العميل/);
  assert.match(page, /Customer Name \/ Name/);
  assert.match(page, /البريد الإلكتروني يظل هو هوية العميل/);
  assert.match(template.split(/\r?\n/, 1)[0] ?? "", /^Customer Email,Customer Name,/);
});
