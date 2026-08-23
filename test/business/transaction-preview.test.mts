import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import test from "node:test";
import {
  buildTransactionFilePreview,
  detectCsvDelimiter,
  parseCsvRows,
  TRANSACTION_PREVIEW_LIMITS,
  TransactionPreviewError,
  type TransactionPreviewErrorCode,
} from "../../src/lib/business/transaction-preview.ts";

function asArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function writeUInt16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

type ZipTestEntry = {
  name: string;
  text: string;
  deflate?: boolean;
  flags?: number;
  method?: number;
  declaredUncompressedSize?: number;
};

function createZip(entries: ZipTestEntry[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(entry.text, "utf8");
    const method = entry.method ?? (entry.deflate === false ? 0 : 8);
    const compressed = method === 8 ? deflateRawSync(raw) : raw;
    const flags = entry.flags ?? 0x0800;
    const declaredUncompressedSize = entry.declaredUncompressedSize ?? raw.length;

    const local = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(flags),
      writeUInt16(method),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(compressed.length),
      writeUInt32(declaredUncompressedSize),
      writeUInt16(name.length),
      writeUInt16(0),
      name,
      compressed,
    ]);
    locals.push(local);

    const central = Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(flags),
      writeUInt16(method),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(compressed.length),
      writeUInt32(declaredUncompressedSize),
      writeUInt16(name.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(localOffset),
      name,
    ]);
    centrals.push(central);
    localOffset += local.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(localOffset),
    writeUInt16(0),
  ]);

  return Buffer.concat([...locals, centralDirectory, end]);
}

function minimalXlsx() {
  return createZip([
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <workbookPr date1904="0"/>
          <sheets><sheet name="Payments &amp; Refunds" sheetId="1" r:id="rId1"/></sheets>
        </workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/>
        </Relationships>`,
    },
    {
      name: "xl/sharedStrings.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="3">
          <si><t>Customer Email</t></si>
          <si><t>Amount Collected</t></si>
          <si><r><t>buyer</t></r><r><t>@example.com</t></r></si>
        </sst>`,
    },
    {
      name: "xl/styles.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs>
        </styleSheet>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
            <row r="1">
              <c r="A1" t="s"><v>0</v></c>
              <c r="B1" t="s"><v>1</v></c>
              <c r="C1" t="inlineStr"><is><t>Transaction Date</t></is></c>
            </row>
            <row r="2">
              <c r="A2" t="s"><v>2</v></c>
              <c r="B2"><v>125.50</v></c>
              <c r="C2" s="1"><v>1</v></c>
            </row>
          </sheetData>
        </worksheet>`,
    },
  ]);
}

async function expectXlsxPreviewError(bytes: Buffer, code: TransactionPreviewErrorCode) {
  await assert.rejects(
    buildTransactionFilePreview({
      fileName: "payments.xlsx",
      fileSize: bytes.length,
      buffer: asArrayBuffer(bytes),
    }),
    (error: unknown) => error instanceof TransactionPreviewError && error.code === code,
  );
}

test("Task 17 detects common CSV delimiters", () => {
  assert.equal(detectCsvDelimiter("a,b,c\n1,2,3\n"), ",");
  assert.equal(detectCsvDelimiter("a;b;c\n1;2;3\n"), ";");
  assert.equal(detectCsvDelimiter("a\tb\tc\n1\t2\t3\n"), "\t");
});

test("Task 17 parses quoted CSV fields, embedded newlines, and escaped quotes", () => {
  assert.deepEqual(
    parseCsvRows('email,amount,note\n"a@example.com","120.50","paid, ok"\n"b@example.com",50,"line 1\nline 2"\n"c@example.com",10,"said ""yes"""\n'),
    [
      ["email", "amount", "note"],
      ["a@example.com", "120.50", "paid, ok"],
      ["b@example.com", "50", "line 1\nline 2"],
      ["c@example.com", "10", 'said "yes"'],
    ],
  );
});

test("Task 17 rejects malformed CSV instead of returning a partial preview", () => {
  assert.throws(
    () => parseCsvRows('email,amount\n"a@example.com,100\n'),
    (error: unknown) => error instanceof TransactionPreviewError && error.code === "CSV_MALFORMED",
  );
});

test("Task 17 builds a bounded CSV preview while preserving full row and column counts", async () => {
  const text = Array.from({ length: 30 }, (_, row) =>
    Array.from({ length: 22 }, (_, column) => `r${row + 1}c${column + 1}`).join(","),
  ).join("\n");
  const bytes = Buffer.from(text, "utf8");
  const preview = await buildTransactionFilePreview({
    fileName: "gateway.CSV",
    fileSize: bytes.length,
    buffer: asArrayBuffer(bytes),
  });

  assert.equal(preview.fileType, "csv");
  assert.equal(preview.totalRows, 30);
  assert.equal(preview.totalColumns, 22);
  assert.equal(preview.previewRows.length, TRANSACTION_PREVIEW_LIMITS.previewRows);
  assert.equal(preview.previewRows[0].length, TRANSACTION_PREVIEW_LIMITS.previewColumns);
  assert.equal(preview.truncatedRows, true);
  assert.equal(preview.truncatedColumns, true);
});

test("Task 17 supports UTF-16LE CSV only when the BOM makes the encoding explicit", async () => {
  const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("email\tamount\r\na@example.com\t50", "utf16le")]);
  const preview = await buildTransactionFilePreview({
    fileName: "gateway.csv",
    fileSize: bytes.length,
    buffer: asArrayBuffer(bytes),
  });

  assert.equal(preview.delimiter, "\t");
  assert.deepEqual(preview.previewRows[1], ["a@example.com", "50"]);
});

test("Task 17 reads a real deflated XLSX archive, shared strings, sheet name, and date cell", async () => {
  const bytes = minimalXlsx();
  const preview = await buildTransactionFilePreview({
    fileName: "payments.xlsx",
    fileSize: bytes.length,
    buffer: asArrayBuffer(bytes),
  });

  assert.equal(preview.fileType, "xlsx");
  assert.equal(preview.sheetName, "Payments & Refunds");
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.totalColumns, 3);
  assert.deepEqual(preview.previewRows, [
    ["Customer Email", "Amount Collected", "Transaction Date"],
    ["buyer@example.com", "125.50", "1900-01-01"],
  ]);
});

test("Task 17 accepts a ZIP comment containing an end-record signature", async () => {
  const bytes = minimalXlsx();
  const comment = Buffer.concat([
    Buffer.from("valid-comment-prefix", "utf8"),
    writeUInt32(0x06054b50),
    Buffer.from("valid-comment-suffix", "utf8"),
  ]);
  const endOffset = bytes.length - 22;
  bytes.writeUInt16LE(comment.length, endOffset + 20);
  const withComment = Buffer.concat([bytes, comment]);

  const preview = await buildTransactionFilePreview({
    fileName: "payments.xlsx",
    fileSize: withComment.length,
    buffer: asArrayBuffer(withComment),
  });

  assert.equal(preview.fileType, "xlsx");
  assert.equal(preview.sheetName, "Payments & Refunds");
  assert.equal(preview.totalRows, 2);
});

test("Task 17 rejects unsupported file types and invalid XLSX archives", async () => {
  const csvBytes = Buffer.from("a,b\n1,2", "utf8");
  await assert.rejects(
    buildTransactionFilePreview({
      fileName: "payments.xls",
      fileSize: csvBytes.length,
      buffer: asArrayBuffer(csvBytes),
    }),
    (error: unknown) => error instanceof TransactionPreviewError && error.code === "UNSUPPORTED_FILE_TYPE",
  );

  const invalidXlsx = Buffer.from("PK-not-a-real-xlsx", "utf8");
  await expectXlsxPreviewError(invalidXlsx, "XLSX_INVALID_ARCHIVE");
});

test("Task 17 rejects encrypted and unsupported-compression XLSX entries", async () => {
  const encrypted = createZip([
    { name: "xl/workbook.xml", text: "<workbook/>", flags: 0x0801 },
  ]);
  await expectXlsxPreviewError(encrypted, "XLSX_UNSUPPORTED_ARCHIVE");

  const unsupportedCompression = createZip([
    { name: "xl/workbook.xml", text: "<workbook/>", method: 99 },
  ]);
  await expectXlsxPreviewError(unsupportedCompression, "XLSX_UNSUPPORTED_ARCHIVE");
});

test("Task 17 rejects XLSX entry-count and declared expansion limits before extraction", async () => {
  const tooManyEntries = createZip([{ name: "xl/workbook.xml", text: "<workbook/>" }]);
  const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endOffset = tooManyEntries.lastIndexOf(endSignature);
  assert.ok(endOffset >= 0);
  const excessiveEntryCount = TRANSACTION_PREVIEW_LIMITS.maxZipEntries + 1;
  tooManyEntries.writeUInt16LE(excessiveEntryCount, endOffset + 8);
  tooManyEntries.writeUInt16LE(excessiveEntryCount, endOffset + 10);
  await expectXlsxPreviewError(tooManyEntries, "XLSX_TOO_LARGE");

  const oversizedDeclaration = createZip([
    {
      name: "xl/workbook.xml",
      text: "<workbook/>",
      declaredUncompressedSize: TRANSACTION_PREVIEW_LIMITS.maxXlsxUncompressedBytes + 1,
    },
  ]);
  await expectXlsxPreviewError(oversizedDeclaration, "XLSX_TOO_LARGE");
});

test("Task 17 rejects traversal paths in XLSX ZIP entries", async () => {
  const traversal = createZip([{ name: "../../evil.xml", text: "nope" }]);
  await expectXlsxPreviewError(traversal, "XLSX_INVALID_ARCHIVE");
});

test("Task 17 refuses files beyond the browser preview size boundary before parsing", async () => {
  const oneByte = new Uint8Array([1]).buffer;
  await assert.rejects(
    buildTransactionFilePreview({
      fileName: "huge.csv",
      fileSize: TRANSACTION_PREVIEW_LIMITS.maxFileBytes + 1,
      buffer: oneByte,
    }),
    (error: unknown) => error instanceof TransactionPreviewError && error.code === "FILE_TOO_LARGE",
  );
});
