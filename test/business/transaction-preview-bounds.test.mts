import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTransactionFilePreview,
  parseCsvRows,
  parseWorksheetXml,
  TRANSACTION_PREVIEW_LIMITS,
  TransactionPreviewError,
} from "../../src/lib/business/transaction-preview.ts";

function u16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32Checksum(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries: Array<{ name: string; text: string }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.text, "utf8");
    const checksum = crc32Checksum(data);
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(checksum),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    localParts.push(local);

    centralParts.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(checksum),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(localOffset),
        name,
      ]),
    );
    localOffset += local.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(localOffset),
    u16(0),
  ]);
  return Buffer.concat([...localParts, central, end]);
}

function asArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

async function expectXlsxError(bytes: Buffer, code: string) {
  await assert.rejects(
    buildTransactionFilePreview({
      fileName: "payments.xlsx",
      fileSize: bytes.length,
      buffer: asArrayBuffer(bytes),
    }),
    (error: unknown) => error instanceof TransactionPreviewError && error.code === code,
  );
}

test("Task 17 CSV parser itself retains only the configured preview matrix", () => {
  const text = Array.from({ length: 40 }, (_, row) =>
    Array.from({ length: 35 }, (_, column) => `r${row + 1}c${column + 1}`).join(","),
  ).join("\n");

  const rows = parseCsvRows(text);
  assert.equal(rows.length, TRANSACTION_PREVIEW_LIMITS.previewRows);
  assert.ok(rows.every((row) => row.length <= TRANSACTION_PREVIEW_LIMITS.previewColumns));
  assert.equal(rows[24][19], "r25c20");
});

test("Task 17 XLSX parser counts sparse columns without expanding the retained matrix", () => {
  const dataRows = Array.from(
    { length: 30 },
    (_, index) =>
      `<row r="${index + 1}"><c r="A${index + 1}"><v>${index + 1}</v></c><c r="ZZZ${index + 1}"><v>far</v></c></row>`,
  ).join("");
  const worksheet = `<worksheet><sheetData>${dataRows}<row r="31"/><row r="32"/></sheetData></worksheet>`;

  const parsed = parseWorksheetXml(worksheet);
  assert.equal(parsed.totalRows, 30);
  assert.equal(parsed.totalColumns, 18_278);
  assert.equal(parsed.rows.length, TRANSACTION_PREVIEW_LIMITS.previewRows);
  assert.ok(parsed.rows.every((row) => row.length <= TRANSACTION_PREVIEW_LIMITS.previewColumns));
  assert.deepEqual(parsed.rows[0], ["1"]);
});

test("Task 17 reports XLSX_WORKBOOK_MISSING when workbook metadata is absent", async () => {
  const bytes = storedZip([{ name: "docProps/core.xml", text: "<core/>" }]);
  await expectXlsxError(bytes, "XLSX_WORKBOOK_MISSING");
});

test("Task 17 reports XLSX_SHEET_MISSING when the sheet relationship cannot be resolved", async () => {
  const bytes = storedZip([
    {
      name: "xl/workbook.xml",
      text: `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Payments" sheetId="1" r:id="rIdMissing"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<Relationships><Relationship Id="rIdOther" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
  ]);
  await expectXlsxError(bytes, "XLSX_SHEET_MISSING");
});
