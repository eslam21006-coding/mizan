import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import test from "node:test";
import {
  isValidTransactionDate,
  isValidTransactionEmail,
  normalizeTransactionEmail,
  parseTransactionAmount,
  validateTransactionImportRows,
} from "../../src/lib/business/transaction-import-validation.ts";
import {
  readTransactionValidationSource,
  TRANSACTION_VALIDATION_SOURCE_LIMITS,
  TransactionValidationSourceError,
} from "../../src/lib/business/transaction-validation-source.ts";

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

type TestZipEntry = {
  name: string;
  text: string;
  compressionMethod?: 0 | 8;
  corruptCrc?: boolean;
};

function createZip(entries: TestZipEntry[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(entry.text, "utf8");
    const compressionMethod = entry.compressionMethod ?? 8;
    const compressed = compressionMethod === 8 ? deflateRawSync(raw) : raw;
    const actualCrc = crc32Checksum(raw);
    const declaredCrc = entry.corruptCrc ? (actualCrc ^ 0xffffffff) >>> 0 : actualCrc;
    const local = Buffer.concat([
      writeUInt32(0x04034b50), writeUInt16(20), writeUInt16(0x0800), writeUInt16(compressionMethod),
      writeUInt16(0), writeUInt16(0), writeUInt32(declaredCrc), writeUInt32(compressed.length),
      writeUInt32(raw.length), writeUInt16(name.length), writeUInt16(0), name, compressed,
    ]);
    locals.push(local);
    centrals.push(Buffer.concat([
      writeUInt32(0x02014b50), writeUInt16(20), writeUInt16(20), writeUInt16(0x0800),
      writeUInt16(compressionMethod), writeUInt16(0), writeUInt16(0), writeUInt32(declaredCrc),
      writeUInt32(compressed.length), writeUInt32(raw.length), writeUInt16(name.length),
      writeUInt16(0), writeUInt16(0), writeUInt16(0), writeUInt16(0), writeUInt32(0),
      writeUInt32(localOffset), name,
    ]));
    localOffset += local.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  return Buffer.concat([
    ...locals,
    centralDirectory,
    writeUInt32(0x06054b50), writeUInt16(0), writeUInt16(0), writeUInt16(entries.length),
    writeUInt16(entries.length), writeUInt32(centralDirectory.length), writeUInt32(localOffset),
    writeUInt16(0),
  ]);
}

function minimalValidationXlsx(
  options: { corruptWorkbookCrc?: boolean; storedWorkbook?: boolean } = {},
) {
  return createZip([
    {
      name: "xl/workbook.xml",
      compressionMethod: options.storedWorkbook ? 0 : 8,
      corruptCrc: options.corruptWorkbookCrc,
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <workbookPr date1904="0"/>
          <sheets><sheet name="Payments" sheetId="1" r:id="rId1"/></sheets>
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
        <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
          <si><t>Email</t></si><si><t>Date</t></si><si><t>Amount</t></si><si><t>Buyer@Example.COM</t></si>
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
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
          <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c><c r="E1" t="s"><v>2</v></c></row>
          <row r="5"><c r="A5" t="s"><v>3</v></c><c r="C5" s="1"><v>45292</v></c><c r="E5"><v>1,250.50</v></c></row>
        </sheetData></worksheet>`,
    },
  ]);
}

function xlsxDateEdgeCases() {
  return createZip([
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <workbookPr date1904="0"/>
          <sheets><sheet name="Payments" sheetId="1" r:id="rId1"/></sheets>
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
      name: "xl/styles.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <numFmts count="1">
            <numFmt numFmtId="164" formatCode="[>1]yyyy-mm-dd"/>
          </numFmts>
          <cellXfs count="4">
            <xf numFmtId="0"/>
            <xf numFmtId="164"/>
            <xf numFmtId="20"/>
            <xf numFmtId="14"/>
          </cellXfs>
        </styleSheet>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
          <row r="1">
            <c r="A1" t="inlineStr"><is><t>Email</t></is></c>
            <c r="C1" t="inlineStr"><is><t>Date</t></is></c>
            <c r="E1" t="inlineStr"><is><t>Amount</t></is></c>
          </row>
          <row r="2">
            <c r="A2" t="inlineStr"><is><t>date@example.com</t></is></c>
            <c r="C2" s="1"><v>45292</v></c>
            <c r="E2"><v>10</v></c>
          </row>
          <row r="3">
            <c r="A3" t="inlineStr"><is><t>time@example.com</t></is></c>
            <c r="C3" s="2"><v>0.5</v></c>
            <c r="E3"><v>20</v></c>
          </row>
          <row r="4">
            <c r="A4" t="inlineStr"><is><t>serial60@example.com</t></is></c>
            <c r="C4" s="3"><v>60.5</v></c>
            <c r="E4"><v>30</v></c>
          </row>
        </sheetData></worksheet>`,
    },
  ]);
}

function xlsxWorksheetAndPhoneticEdgeCases() {
  return createZip([
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheets>
            <sheet name="Chart" sheetId="1" r:id="rIdChart"/>
            <sheet name="Payments" sheetId="2" r:id="rIdPayments"/>
          </sheets>
        </workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rIdChart"
            Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chartsheet"
            Target="chartsheets/sheet1.xml"/>
          <Relationship Id="rIdPayments"
            Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
            Target="worksheets/sheet1.xml"/>
        </Relationships>`,
    },
    {
      name: "xl/sharedStrings.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
          <si><t>Email</t></si>
          <si><t>Date</t></si>
          <si><t>Amount</t></si>
          <si><r><t>buyer@example.com</t></r><rPh sb="0" eb="5"><t>BUYER-PHONETIC</t></rPh></si>
        </sst>`,
    },
    {
      name: "xl/chartsheets/sheet1.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <chartsheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"/>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      text: `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
          <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c><c r="E1" t="s"><v>2</v></c></row>
          <row r="2">
            <c r="A2" t="s"><v>3</v></c>
            <c r="C2" t="inlineStr"><is><r><t>2026-08-23</t></r><rPh sb="0" eb="4"><t>DATE-PHONETIC</t></rPh></is></c>
            <c r="E2"><v>25</v></c>
          </row>
        </sheetData></worksheet>`,
    },
  ]);
}

test("Task 19 normalizes imported customer email with trim plus lowercase", () => {
  assert.equal(normalizeTransactionEmail("  Buyer@Example.COM  "), "buyer@example.com");
});

test("Task 19 validates email syntax and preserves required-vs-invalid classification", () => {
  assert.equal(isValidTransactionEmail(" Buyer@Example.COM "), true);
  assert.equal(isValidTransactionEmail("bad@@example.com"), false);
  assert.equal(isValidTransactionEmail("   "), false);
  assert.equal(isValidTransactionEmail("@example.com"), false);
  assert.equal(isValidTransactionEmail("buyer@"), false);

  const result = validateTransactionImportRows([
    { rowNumber: 1, customerEmail: "   ", transactionDate: "2026-08-23", amountCollected: "10" },
    { rowNumber: 2, customerEmail: "bad@@example.com", transactionDate: "2026-08-23", amountCollected: "10" },
  ]);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["EMAIL_REQUIRED", "EMAIL_INVALID"]);
});

test("Task 19 accepts real ISO dates including years before 0100 and rejects ambiguous or impossible dates", () => {
  assert.equal(isValidTransactionDate("2026-08-23"), true);
  assert.equal(isValidTransactionDate("2026-08-23T14:30:00Z"), true);
  assert.equal(isValidTransactionDate("0001-01-01"), true);
  assert.equal(isValidTransactionDate("0001-01-01T12:00:00Z"), true);
  assert.equal(isValidTransactionDate("2026-02-30"), false);
  assert.equal(isValidTransactionDate("23/08/2026"), false);
});

test("Task 19 parses finite decimal forms without inventing currency semantics", () => {
  assert.equal(parseTransactionAmount("1,234.50"), 1234.5);
  assert.equal(parseTransactionAmount("-80"), -80);
  assert.equal(parseTransactionAmount("0"), 0);
  assert.equal(parseTransactionAmount(".5"), 0.5);
  assert.equal(parseTransactionAmount("1."), 1);
  assert.equal(parseTransactionAmount("1e3"), 1000);
  assert.equal(parseTransactionAmount("$100"), null);
  assert.equal(parseTransactionAmount("1,23.00"), null);
});

test("Task 19 validates required fields, skips the first source row only when explicitly selected, and caps issue samples", () => {
  const rows = [
    { rowNumber: 4, customerEmail: "Email", transactionDate: "Date", amountCollected: "Amount" },
    { rowNumber: 5, customerEmail: " Buyer@Example.COM ", transactionDate: "2026-08-23", amountCollected: "125.50" },
    { rowNumber: 6, customerEmail: "bad email", transactionDate: "2026-02-30", amountCollected: "$25" },
  ];

  const result = validateTransactionImportRows(rows, { skipFirstRow: true, issueSampleLimit: 2 });
  assert.equal(result.totalSourceRows, 3);
  assert.equal(result.skippedHeaderRows, 1);
  assert.equal(result.checkedRows, 2);
  assert.equal(result.validRows, 1);
  assert.equal(result.invalidRows, 1);
  assert.equal(result.issueCount, 3);
  assert.equal(result.issues.length, 2);
  assert.equal(result.issuesTruncated, true);
  assert.equal(result.isValid, false);
});

test("Task 19 does not skip a header-looking first row unless explicitly requested", () => {
  const result = validateTransactionImportRows([
    { rowNumber: 1, customerEmail: "Email", transactionDate: "Date", amountCollected: "Amount" },
    { rowNumber: 2, customerEmail: "buyer@example.com", transactionDate: "2026-08-23", amountCollected: "25" },
  ]);

  assert.equal(result.skippedHeaderRows, 0);
  assert.equal(result.checkedRows, 2);
  assert.equal(result.validRows, 1);
  assert.equal(result.invalidRows, 1);
  assert.equal(result.issueCount, 3);
});

test("Task 19 reads every non-empty CSV source row instead of validating only the 25-row preview", async () => {
  const lines = ["email,date,amount,ignored"];
  for (let index = 1; index <= 40; index += 1) {
    lines.push(`buyer${index}@example.com,2026-08-23,${index},extra`);
  }
  const bytes = Buffer.from(lines.join("\n"), "utf8");
  const source = await readTransactionValidationSource({
    fileName: "payments.csv",
    fileSize: bytes.length,
    buffer: asArrayBuffer(bytes),
    columns: [0, 1, 2],
  });

  assert.equal(source.totalRows, 41);
  assert.deepEqual(source.rows[40], {
    rowNumber: 41,
    values: ["buyer40@example.com", "2026-08-23", "40"],
  });
});

test("Task 19 fails closed when the source exceeds the browser validation row cap", async () => {
  const lines = Array.from(
    { length: TRANSACTION_VALIDATION_SOURCE_LIMITS.maxRows + 1 },
    (_, index) => `buyer${index}@example.com,2026-08-23,1`,
  );
  const bytes = Buffer.from(lines.join("\n"), "utf8");

  await assert.rejects(
    readTransactionValidationSource({
      fileName: "too-many.csv",
      fileSize: bytes.length,
      buffer: asArrayBuffer(bytes),
      columns: [0, 1, 2],
    }),
    (error: unknown) =>
      error instanceof TransactionValidationSourceError && error.code === "SOURCE_TOO_MANY_ROWS",
  );
});

test("Task 19 reads mapped columns beyond the visible preview width", async () => {
  const row = Array.from({ length: 30 }, (_, column) => `c${column + 1}`);
  row[25] = "far@example.com";
  row[27] = "2026-08-23";
  row[29] = "99.50";
  const text = row.join(",");
  const bytes = Buffer.from(text, "utf8");
  const source = await readTransactionValidationSource({
    fileName: "wide.csv",
    fileSize: bytes.length,
    buffer: asArrayBuffer(bytes),
    columns: [25, 27, 29],
  });

  assert.deepEqual(source.rows[0]?.values, ["far@example.com", "2026-08-23", "99.50"]);
});

test("Task 19 reads selected XLSX values and preserves the worksheet row number", async () => {
  const bytes = minimalValidationXlsx();
  const source = await readTransactionValidationSource({
    fileName: "payments.xlsx",
    fileSize: bytes.length,
    buffer: asArrayBuffer(bytes),
    columns: [0, 2, 4],
  });

  assert.equal(source.totalRows, 2);
  assert.deepEqual(source.rows[0], { rowNumber: 1, values: ["Email", "Date", "Amount"] });
  assert.deepEqual(source.rows[1], {
    rowNumber: 5,
    values: ["Buyer@Example.COM", "2024-01-01", "1,250.50"],
  });
});

test("Task 19 handles conditional XLSX date formats but rejects time-only cells and Excel serial 60", async () => {
  const bytes = xlsxDateEdgeCases();
  const source = await readTransactionValidationSource({
    fileName: "date-edge-cases.xlsx",
    fileSize: bytes.length,
    buffer: asArrayBuffer(bytes),
    columns: [0, 2, 4],
  });

  assert.deepEqual(source.rows[1]?.values, ["date@example.com", "2024-01-01", "10"]);
  assert.deepEqual(source.rows[2]?.values, ["time@example.com", "0.5", "20"]);
  assert.deepEqual(source.rows[3]?.values, ["serial60@example.com", "60.5", "30"]);

  const result = validateTransactionImportRows(
    source.rows.map((row) => ({
      rowNumber: row.rowNumber,
      customerEmail: row.values[0] ?? "",
      transactionDate: row.values[1] ?? "",
      amountCollected: row.values[2] ?? "",
    })),
    { skipFirstRow: true },
  );
  assert.equal(result.checkedRows, 3);
  assert.equal(result.validRows, 1);
  assert.equal(result.invalidRows, 2);
  assert.deepEqual(result.issues.map((issue) => issue.code), [
    "TRANSACTION_DATE_INVALID",
    "TRANSACTION_DATE_INVALID",
  ]);
});

test("Task 19 validates XLSX CRC-32 for both deflated and stored entries", async () => {
  for (const storedWorkbook of [false, true]) {
    const bytes = minimalValidationXlsx({ corruptWorkbookCrc: true, storedWorkbook });
    await assert.rejects(
      readTransactionValidationSource({
        fileName: storedWorkbook ? "bad-stored-crc.xlsx" : "bad-deflated-crc.xlsx",
        fileSize: bytes.length,
        buffer: asArrayBuffer(bytes),
        columns: [0, 2, 4],
      }),
      (error: unknown) =>
        error instanceof TransactionValidationSourceError && error.code === "SOURCE_XLSX_INVALID",
    );
  }
});

test("Task 19 selects the first worksheet and excludes XLSX phonetic rich-text runs", async () => {
  const bytes = xlsxWorksheetAndPhoneticEdgeCases();
  const source = await readTransactionValidationSource({
    fileName: "worksheet-and-phonetics.xlsx",
    fileSize: bytes.length,
    buffer: asArrayBuffer(bytes),
    columns: [0, 2, 4],
  });

  assert.equal(source.totalRows, 2);
  assert.deepEqual(source.rows[0], { rowNumber: 1, values: ["Email", "Date", "Amount"] });
  assert.deepEqual(source.rows[1], {
    rowNumber: 2,
    values: ["buyer@example.com", "2026-08-23", "25"],
  });

  const result = validateTransactionImportRows(
    source.rows.map((row) => ({
      rowNumber: row.rowNumber,
      customerEmail: row.values[0] ?? "",
      transactionDate: row.values[1] ?? "",
      amountCollected: row.values[2] ?? "",
    })),
    { skipFirstRow: true },
  );
  assert.equal(result.checkedRows, 1);
  assert.equal(result.validRows, 1);
  assert.equal(result.invalidRows, 0);
});

test("Task 19 rejects duplicate mapped source columns at the source-reader boundary", async () => {
  const bytes = Buffer.from("a,b\n1,2", "utf8");
  await assert.rejects(
    readTransactionValidationSource({
      fileName: "payments.csv",
      fileSize: bytes.length,
      buffer: asArrayBuffer(bytes),
      columns: [0, 0],
    }),
    (error: unknown) => error instanceof TransactionValidationSourceError && error.code === "INVALID_MAPPING",
  );
});