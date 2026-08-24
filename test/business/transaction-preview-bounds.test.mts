import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTransactionFilePreview,
  parseCsvRows,
  parseWorksheetXml,
  TRANSACTION_PREVIEW_LIMITS,
  TransactionPreviewError,
} from "../../src/lib/business/transaction-preview.ts";
import { asArrayBuffer, createZip } from "../helpers/zip-crc.ts";

function storedZip(entries: Array<{ name: string; text: string }>) {
  return createZip(entries.map((entry) => ({ ...entry, compressionMethod: 0 })));
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
