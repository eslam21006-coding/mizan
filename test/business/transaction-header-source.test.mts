import assert from "node:assert/strict";
import test from "node:test";
import { fingerprintTransactionHeaderRow } from "../../src/lib/business/transaction-column-mapping.ts";
import {
  materializeTransactionHeaderRow,
  readTransactionHeaderRow,
} from "../../src/lib/business/transaction-header-source.ts";

function csvSource(text: string, fileName = "transactions.csv") {
  const bytes = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return { fileName, fileSize: bytes.byteLength, buffer };
}

test("transaction header reader skips leading blank CSV records and returns the real header", async () => {
  const source = csvSource(
    "\r\n,,\r\n\nInternal transaction id,Customer email,Currency,Total amount paid,Status,Transaction date\r\ntx_1,a@example.com,USD,10,succeeded,28-Aug-26\r\n",
  );

  const header = await readTransactionHeaderRow(source);
  assert.deepEqual(header, [
    "Internal transaction id",
    "Customer email",
    "Currency",
    "Total amount paid",
    "Status",
    "Transaction date",
  ]);
});

test("transaction header reader preserves columns beyond the 20-column UI preview", async () => {
  const headers = Array.from({ length: 25 }, (_, index) => `Gateway column ${index + 1}`);
  headers[20] = "Currency";
  headers[21] = "Customer email";
  headers[22] = "Transaction date";
  headers[23] = "Total amount paid";
  headers[24] = "Internal transaction id";

  const source = csvSource(`${headers.join(",")}\n${Array.from({ length: 25 }, () => "x").join(",")}\n`);
  const header = await readTransactionHeaderRow(source);

  assert.ok(header);
  assert.equal(header.length, 25);
  assert.equal(header[21], "Customer email");
  assert.equal(header[24], "Internal transaction id");
});

test("mapping fingerprint changes when a trailing header outside the UI preview changes", async () => {
  const first = Array.from({ length: 25 }, (_, index) => `Gateway column ${index + 1}`);
  const changed = [...first];
  changed[24] = "Different trailing column";

  assert.notEqual(
    await fingerprintTransactionHeaderRow(first),
    await fingerprintTransactionHeaderRow(changed),
  );
});

test("CSV header reader keeps quoted delimiters inside the full header cell", async () => {
  const source = csvSource(
    '"Customer email","Transaction date","Total amount paid","Internal, transaction id",Currency\n',
  );
  const header = await readTransactionHeaderRow(source);
  assert.deepEqual(header, [
    "Customer email",
    "Transaction date",
    "Total amount paid",
    "Internal, transaction id",
    "Currency",
  ]);
});

test("blank sparse XLSX rows never materialize a far-right dense header array", () => {
  const result = materializeTransactionHeaderRow(new Map(), 16_383, false);
  assert.equal(result, null);
});

test("non-empty sparse XLSX headers preserve blank positions when materialized", () => {
  const result = materializeTransactionHeaderRow(
    new Map([
      [0, "Customer email"],
      [4, "Total amount paid"],
    ]),
    4,
    true,
  );

  assert.deepEqual(result, ["Customer email", "", "", "", "Total amount paid"]);
});
